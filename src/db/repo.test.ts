import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@prisma/client";
import { createRepo } from "./repo";

const tempRoot = resolve(
  "/var/folders/xp/2fyz9z3j7mgfzfkdtpcn95kr0000gn/T/opencode",
  `db-repo-${crypto.randomUUID()}`,
);

const databasePath = join(tempRoot, "edgar.db");
const migrationPath = resolve(
  import.meta.dir,
  "../../DATABASE/prisma/migrations/20260826155939_init/migration.sql",
);

let prisma: PrismaClient;
let repo: ReturnType<typeof createRepo>;

const getRepo = (): ReturnType<typeof createRepo> => {
  if (repo === undefined) {
    throw new Error("repo not initialized");
  }

  return repo;
};

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

const makeInput = (
  overrides: {
    readonly orgFilePath?: string;
    readonly cleanFilePath?: string;
    readonly chunks?: readonly {
      readonly xpathStart: string;
      readonly xpathEnd: string;
      readonly orderInFile: number;
      readonly text: string;
    }[];
    readonly tables?: readonly {
      readonly xpath: string;
      readonly orderInFile: number;
      readonly text: string;
      readonly prevChunkOrderInFile: number | null;
      readonly nextChunkOrderInFile: number | null;
    }[];
  } = {},
) => ({
  orgFilePath: overrides.orgFilePath ?? `/tmp/${crypto.randomUUID()}.html`,
  cleanFilePath:
    overrides.cleanFilePath ?? `/tmp/${crypto.randomUUID()}_clean.html`,
  chunks: overrides.chunks ?? [
    {
      xpathStart: "/html/body/table[1]",
      xpathEnd: "/html/body/table[1]",
      orderInFile: 0,
      text: "chunk-0",
    },
    {
      xpathStart: "/html/body/table[2]",
      xpathEnd: "/html/body/table[2]",
      orderInFile: 1,
      text: "chunk-1",
    },
  ],
  tables: overrides.tables ?? [
    {
      xpath: "/html/body/table[1]",
      orderInFile: 0,
      text: "table-0",
      prevChunkOrderInFile: null,
      nextChunkOrderInFile: 1,
    },
  ],
});

beforeAll(async () => {
  await mkdir(dirname(databasePath), { recursive: true });
  const adapter = new PrismaLibSql({ url: `file:${databasePath}` });
  prisma = new PrismaClient({ adapter });
  repo = createRepo(prisma);
  await initSqliteSchema();
});

afterAll(async () => {
  await prisma?.$disconnect();
  await rm(tempRoot, { recursive: true, force: true });
});

describe("db repo", () => {
  test("saves and reads a full graph", async () => {
    const input = makeInput();

    const saved = await getRepo()
      .saveFileGraph(input)
      .match(
        (value) => value,
        (error) => {
          throw new Error(`unexpected error: ${JSON.stringify(error)}`);
        },
      );

    expect(saved.file.orgFilePath).toBe(input.orgFilePath);
    expect(saved.chunks).toHaveLength(2);
    expect(saved.tables).toHaveLength(1);
    expect(saved.tables[0]?.prevChunk).toBeNull();
    expect(saved.tables[0]?.nextChunk?.orderInFile).toBe(1);

    const fetched = await getRepo()
      .getFileGraphByOrgPath(input.orgFilePath)
      .match(
        (value) => value,
        (error) => {
          throw new Error(`unexpected error: ${JSON.stringify(error)}`);
        },
      );

    expect(fetched?.file.id).toBe(saved.file.id);
    expect(fetched?.chunks.map((chunk) => chunk.orderInFile)).toEqual([0, 1]);
    expect(fetched?.tables.map((table) => table.orderInFile)).toEqual([0]);
  });

  test("replace semantics delete and recreate with a new file id", async () => {
    const orgFilePath = `/tmp/${crypto.randomUUID()}.html`;

    const first = await getRepo()
      .saveFileGraph(
        makeInput({
          orgFilePath,
          chunks: [],
          tables: [],
        }),
      )
      .match(
        (value) => value,
        (error) => {
          throw new Error(`unexpected error: ${JSON.stringify(error)}`);
        },
      );

    const second = await getRepo()
      .saveFileGraph(
        makeInput({
          orgFilePath,
          cleanFilePath: `/tmp/${crypto.randomUUID()}_clean.html`,
          chunks: [
            {
              xpathStart: "/a",
              xpathEnd: "/a",
              orderInFile: 0,
              text: "replacement",
            },
          ],
          tables: [],
        }),
      )
      .match(
        (value) => value,
        (error) => {
          throw new Error(`unexpected error: ${JSON.stringify(error)}`);
        },
      );

    expect(second.file.id).not.toBe(first.file.id);
    expect(second.chunks).toHaveLength(1);
    expect(second.tables).toHaveLength(0);

    const fetched = await getRepo()
      .getFileGraphByOrgPath(orgFilePath)
      .match(
        (value) => value,
        (error) => {
          throw new Error(`unexpected error: ${JSON.stringify(error)}`);
        },
      );

    expect(fetched?.file.id).toBe(second.file.id);
    expect(fetched?.chunks).toHaveLength(1);
    expect(fetched?.chunks[0]?.text).toBe("replacement");
  });

  test("allows empty chunks and tables", async () => {
    const saved = await getRepo()
      .saveFileGraph(
        makeInput({
          chunks: [],
          tables: [],
        }),
      )
      .match(
        (value) => value,
        (error) => {
          throw new Error(`unexpected error: ${JSON.stringify(error)}`);
        },
      );

    expect(saved.chunks).toEqual([]);
    expect(saved.tables).toEqual([]);
  });

  test("rejects missing chunk references", async () => {
    const result = await getRepo().saveFileGraph(
      makeInput({
        tables: [
          {
            xpath: "/table",
            orderInFile: 0,
            text: "bad",
            prevChunkOrderInFile: 99,
            nextChunkOrderInFile: null,
          },
        ],
      }),
    );

    const error = await result.match(
      () => null,
      (value) => value,
    );

    expect(error?.type).toBe("missing_chunk_reference");
  });

  test("rejects duplicate chunk orders", async () => {
    const result = await getRepo().saveFileGraph(
      makeInput({
        chunks: [
          {
            xpathStart: "/a",
            xpathEnd: "/a",
            orderInFile: 0,
            text: "one",
          },
          {
            xpathStart: "/b",
            xpathEnd: "/b",
            orderInFile: 0,
            text: "two",
          },
        ],
        tables: [],
      }),
    );

    const error = await result.match(
      () => null,
      (value) => value,
    );

    expect(error?.type).toBe("duplicate_chunk_order");
  });

  test("rejects duplicate table orders", async () => {
    const result = await getRepo().saveFileGraph(
      makeInput({
        tables: [
          {
            xpath: "/t1",
            orderInFile: 0,
            text: "one",
            prevChunkOrderInFile: null,
            nextChunkOrderInFile: null,
          },
          {
            xpath: "/t2",
            orderInFile: 0,
            text: "two",
            prevChunkOrderInFile: null,
            nextChunkOrderInFile: null,
          },
        ],
      }),
    );

    const error = await result.match(
      () => null,
      (value) => value,
    );

    expect(error?.type).toBe("duplicate_table_order");
  });

  test("read by id returns the persisted aggregate", async () => {
    const saved = await getRepo()
      .saveFileGraph(makeInput())
      .match(
        (value) => value,
        (error) => {
          throw new Error(`unexpected error: ${JSON.stringify(error)}`);
        },
      );

    const fetched = await getRepo()
      .getFileGraphById(saved.file.id)
      .match(
        (value) => value,
        (error) => {
          throw new Error(`unexpected error: ${JSON.stringify(error)}`);
        },
      );

    expect(fetched?.file.id).toBe(saved.file.id);
    expect(fetched?.chunks[0]?.orderInFile).toBe(0);
  });
});
