import { copyFile, mkdir, rm } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import type { PrismaClient } from "@prisma/client";

const migrationPath = resolve(
  import.meta.dir,
  "../DATABASE/prisma/migrations/20260826155939_init/migration.sql",
);

export type PipelineDbContext = Readonly<{
  prisma: PrismaClient;
  tempRoot: string;
  databasePath: string;
  dbDumpPath: string;
}>;

const initSqliteSchema = async (prisma: PrismaClient): Promise<void> => {
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

const createPaths = (): Readonly<{
  tempRoot: string;
  databasePath: string;
  dbDumpPath: string;
}> => {
  const tempRoot = resolve(
    "/var/folders/xp/2fyz9z3j7mgfzfkdtpcn95kr0000gn/T/opencode",
    `pipeline-full-${crypto.randomUUID()}`,
  );
  const databasePath = join(tempRoot, "edgar.db");
  const dbDumpPath = resolve(dirname(tempRoot), `${basename(tempRoot)}.db`);

  return { tempRoot, databasePath, dbDumpPath };
};

export const setupPipelineDb = async (): Promise<PipelineDbContext> => {
  const { tempRoot, databasePath, dbDumpPath } = createPaths();

  process.env.DATABASE_URL = `file:${databasePath}`;

  await mkdir(dirname(databasePath), { recursive: true });

  const [{ PrismaLibSql }, { PrismaClient }] = await Promise.all([
    import("@prisma/adapter-libsql"),
    import("@prisma/client"),
  ]);

  const adapter = new PrismaLibSql({ url: `file:${databasePath}` });
  const prisma = new PrismaClient({ adapter });

  await initSqliteSchema(prisma);

  return { prisma, tempRoot, databasePath, dbDumpPath };
};

export const teardownPipelineDb = async (
  context: PipelineDbContext,
): Promise<void> => {
  await copyFile(context.databasePath, context.dbDumpPath).catch(() => null);
  console.log("pipeline e2e db dump", context.dbDumpPath);
  await context.prisma.$disconnect();
  await rm(context.tempRoot, { recursive: true, force: true });
};
