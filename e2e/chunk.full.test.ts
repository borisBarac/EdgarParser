import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@prisma/client";
import { createRepo } from "../src/db/repo";
import { chunk } from "../src/pipeline/steps/chunk";

const tempRoot = resolve(
  "/var/folders/xp/2fyz9z3j7mgfzfkdtpcn95kr0000gn/T/opencode",
  `chunk-full-${crypto.randomUUID()}`,
);

const databasePath = join(tempRoot, "edgar.db");
const migrationPath = resolve(
  import.meta.dir,
  "../DATABASE/prisma/migrations/20260826155939_init/migration.sql",
);
const cleanedFilePath = resolve(
  import.meta.dir,
  "../edgar_test_files/cleaned_tsm.html",
);

let prisma: PrismaClient;

const initSqliteSchema = async (): Promise<void> => {
  const sql = await Bun.file(migrationPath).text();
  const statements = sql
    .split(";")
    .map((statement) =>
      statement
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter((statement) => statement.length > 0);

  await prisma.$executeRawUnsafe("PRAGMA foreign_keys = ON");

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }
};

beforeAll(async () => {
  await mkdir(dirname(databasePath), { recursive: true });
  const adapter = new PrismaLibSql({ url: `file:${databasePath}` });
  prisma = new PrismaClient({ adapter });
  await initSqliteSchema();
});

afterAll(async () => {
  await prisma?.$disconnect();
  await rm(tempRoot, { recursive: true, force: true });
});

describe("chunk full e2e", () => {
  test("writes the full cleaned tsm aggregate to db", async () => {
    const repo = createRepo(prisma);
    const originalFilePath = `/tmp/${crypto.randomUUID()}_cleaned_tsm.html`;

    const result = await chunk(repo, {
      originalFilePath,
      cleanedFilePath,
    });

    const value = await result.match(
      (output) => output,
      (error) => {
        throw new Error(`unexpected error: ${JSON.stringify(error)}`);
      },
    );

    const persisted = await repo.getFileGraphByOrgPath(originalFilePath).match(
      (output) => output,
      (error) => {
        throw new Error(`unexpected error: ${JSON.stringify(error)}`);
      },
    );

    expect(persisted).not.toBeNull();
    expect(persisted).toEqual(value);
    expect(value.file.orgFilePath).toBe(originalFilePath);
    expect(value.file.cleanFilePath).toBe(cleanedFilePath);
    expect(value.chunks.length).toBeGreaterThan(0);
    expect(value.tables.length).toBeGreaterThan(0);

    console.log(JSON.stringify(persisted, null, 2));
  });
});
