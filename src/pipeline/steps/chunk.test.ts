import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@prisma/client";
import { createRepo } from "../../db/repo";
import { chunk } from "./chunk";

const tempRoot = resolve(
  "/var/folders/xp/2fyz9z3j7mgfzfkdtpcn95kr0000gn/T/opencode",
  `chunk-step-${crypto.randomUUID()}`,
);

const databasePath = join(tempRoot, "edgar.db");
const migrationPath = resolve(
  import.meta.dir,
  "../../../DATABASE/prisma/migrations/20260826155939_init/migration.sql",
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

describe("chunk step", () => {
  test("preserves structure across text and table boundaries", async () => {
    const repo = createRepo(prisma);
    const originalFilePath = `/tmp/${crypto.randomUUID()}.html`;
    const cleanedFilePath = join(tempRoot, "structured_cleaned.html");
    const html = [
      "<html><body>",
      '<article id="a"><h1>Alpha</h1><p>First</p>',
      '<table id="t1"><tbody><tr><td>One</td></tr></tbody></table>',
      "<p>Second</p></article>",
      '<table id="t2"><tbody><tr><td>Two</td></tr></tbody></table>',
      "<footer><span>Tail</span></footer>",
      "</body></html>",
    ].join("");

    await Bun.write(cleanedFilePath, html);

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

    expect(value.file.orgFilePath).toBe(originalFilePath);
    expect(value.chunks).toHaveLength(3);
    expect(value.tables).toHaveLength(2);
    expect(value.chunks.map((chunk) => chunk.text)).toEqual([
      '<article id="a"><h1>Alpha</h1><p>First</p></article>',
      '<article id="a"><p>Second</p></article>',
      "<footer><span>Tail</span></footer>",
    ]);
    expect(value.tables.map((table) => table.text)).toEqual([
      '<table id="t1"><tbody><tr><td>One</td></tr></tbody></table>',
      '<table id="t2"><tbody><tr><td>Two</td></tr></tbody></table>',
    ]);
    expect(value.tables[0]?.prevChunk?.orderInFile).toBe(0);
    expect(value.tables[0]?.nextChunk?.orderInFile).toBe(1);
    expect(value.tables[1]?.prevChunk?.orderInFile).toBe(1);
    expect(value.tables[1]?.nextChunk?.orderInFile).toBe(2);
  });

  test("keeps original sibling indexes after a table split", async () => {
    const repo = createRepo(prisma);
    const originalFilePath = `/tmp/${crypto.randomUUID()}_xpath_split.html`;
    const cleanedFilePath = join(tempRoot, "xpath_split_cleaned.html");
    const html = [
      "<html><body>",
      "<div>First</div>",
      '<table id="t1"></table>',
      "<div>Second</div>",
      "</body></html>",
    ].join("");

    await Bun.write(cleanedFilePath, html);

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

    expect(value.chunks.map((chunk) => chunk.xpathStart)).toEqual([
      '/*[local-name()="html"][1]/*[local-name()="body"][1]/*[local-name()="div"][1]',
      '/*[local-name()="html"][1]/*[local-name()="body"][1]/*[local-name()="div"][2]',
    ]);
    expect(value.chunks.map((chunk) => chunk.xpathEnd)).toEqual([
      '/*[local-name()="html"][1]/*[local-name()="body"][1]/*[local-name()="div"][1]',
      '/*[local-name()="html"][1]/*[local-name()="body"][1]/*[local-name()="div"][2]',
    ]);
  });

  test("links consecutive tables to surrounding chunks", async () => {
    const repo = createRepo(prisma);
    const originalFilePath = `/tmp/${crypto.randomUUID()}_two_tables.html`;
    const cleanedFilePath = join(tempRoot, "two_tables_cleaned.html");
    const html = [
      "<html><body>",
      "<div>Lead</div>",
      '<table id="t1"></table>',
      '<table id="t2"></table>',
      "<div>Trail</div>",
      "</body></html>",
    ].join("");

    await Bun.write(cleanedFilePath, html);

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

    expect(value.chunks.map((chunk) => chunk.text)).toEqual([
      "<div>Lead</div>",
      "<div>Trail</div>",
    ]);
    expect(value.tables.map((table) => table.orderInFile)).toEqual([0, 1]);
    expect(value.tables[0]?.prevChunk?.orderInFile).toBe(0);
    expect(value.tables[0]?.nextChunk?.orderInFile).toBe(1);
    expect(value.tables[1]?.prevChunk?.orderInFile).toBe(0);
    expect(value.tables[1]?.nextChunk?.orderInFile).toBe(1);
  });

  test("skips whitespace-only regions", async () => {
    const repo = createRepo(prisma);
    const originalFilePath = `/tmp/${crypto.randomUUID()}_whitespace.html`;
    const cleanedFilePath = join(tempRoot, "whitespace_cleaned.html");
    const html = [
      "<html><body>",
      "<div>Before</div>",
      '<table id="t1"></table>',
      "   \n   ",
      '<table id="t2"></table>',
      "<div>After</div>",
      "</body></html>",
    ].join("");

    await Bun.write(cleanedFilePath, html);

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

    expect(value.chunks.map((chunk) => chunk.text)).toEqual([
      "<div>Before</div>",
      "<div>After</div>",
    ]);
    expect(value.tables[0]?.prevChunk?.orderInFile).toBe(0);
    expect(value.tables[0]?.nextChunk?.orderInFile).toBe(1);
    expect(value.tables[1]?.prevChunk?.orderInFile).toBe(0);
    expect(value.tables[1]?.nextChunk?.orderInFile).toBe(1);
  });

  test("handles documents without tables", async () => {
    const repo = createRepo(prisma);
    const originalFilePath = `/tmp/${crypto.randomUUID()}_no_tables.html`;
    const cleanedFilePath = join(tempRoot, "no_tables_cleaned.html");
    const html =
      "<html><body><section><p>Only text</p></section></body></html>";

    await Bun.write(cleanedFilePath, html);

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

    expect(value.chunks).toHaveLength(1);
    expect(value.tables).toHaveLength(0);
    expect(value.chunks[0]?.text).toBe("<section><p>Only text</p></section>");
  });

  test("fails oversized chunks", async () => {
    const repo = createRepo(prisma);
    const originalFilePath = `/tmp/${crypto.randomUUID()}_oversized.html`;
    const cleanedFilePath = join(tempRoot, "oversized_cleaned.html");
    const text = Array.from(
      { length: 30000 },
      (_, index) => `word${index}`,
    ).join(" ");
    const html = `<html><body><article>${text}</article></body></html>`;

    await Bun.write(cleanedFilePath, html);

    const result = await chunk(repo, {
      originalFilePath,
      cleanedFilePath,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe("extract_file_graph");
      expect(result.error.path).toBe(cleanedFilePath);
      if (result.error.type === "extract_file_graph") {
        expect(result.error.cause.type).toBe("chunk_too_large");
        if (result.error.cause.type === "chunk_too_large") {
          expect(result.error.cause.path).toBe(cleanedFilePath);
          expect(result.error.cause.orderInFile).toBe(0);
          expect(result.error.cause.maxTokens).toBe(50000);
          expect(result.error.cause.tokenCount).toBeGreaterThan(50000);
        }
      }
    }
  });
});
