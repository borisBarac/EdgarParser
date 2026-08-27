import { describe, expect, test } from "bun:test";
import { createRepo } from "../src/db/repo";
import { setupPipelineDb, teardownPipelineDb } from "./pipeline.db";

describe("pipeline db helpers", () => {
  test("setup and teardown preserve a saved graph in the dumped db", async () => {
    const context = await setupPipelineDb();
    const repo = createRepo(context.prisma);
    const orgFilePath = `/tmp/${crypto.randomUUID()}.html`;

    const input = {
      orgFilePath,
      cleanFilePath: `/tmp/${crypto.randomUUID()}_clean.html`,
      chunks: [
        {
          xpathStart: "/html/body/div[1]",
          xpathEnd: "/html/body/div[1]",
          orderInFile: 0,
          text: "chunk-0",
        },
      ],
      tables: [
        {
          xpath: "/html/body/table[1]",
          orderInFile: 0,
          text: "<table><tbody><tr><td>table-0</td></tr></tbody></table>",
          prevChunkOrderInFile: null,
          nextChunkOrderInFile: null,
        },
      ],
    };

    const saved = await repo.saveFileGraph(input).match(
      (value) => value,
      (error) => {
        throw new Error(`unexpected error: ${JSON.stringify(error)}`);
      },
    );

    const fetched = await repo.getFileGraphByOrgPath(orgFilePath).match(
      (value) => value,
      (error) => {
        throw new Error(`unexpected error: ${JSON.stringify(error)}`);
      },
    );

    expect(fetched?.file.id).toBe(saved.file.id);
    expect(fetched?.chunks[0]?.text).toBe("chunk-0");
    expect(fetched?.tables[0]?.text).toContain("table-0");

    await teardownPipelineDb(context);

    const [{ PrismaLibSql }, { PrismaClient }] = await Promise.all([
      import("@prisma/adapter-libsql"),
      import("@prisma/client"),
    ]);

    const adapter = new PrismaLibSql({ url: `file:${context.dbDumpPath}` });
    const dumpedPrisma = new PrismaClient({ adapter });
    const dumpedRepo = createRepo(dumpedPrisma);

    const dumped = await dumpedRepo.getFileGraphByOrgPath(orgFilePath).match(
      (value) => value,
      (error) => {
        throw new Error(`unexpected error: ${JSON.stringify(error)}`);
      },
    );

    expect(dumped?.file.id).toBe(saved.file.id);
    expect(dumped?.file.orgFilePath).toBe(orgFilePath);
    expect(dumped?.chunks[0]?.text).toBe("chunk-0");
    expect(dumped?.tables[0]?.text).toContain("table-0");

    await dumpedPrisma.$disconnect();
  });
});
