// @ts-nocheck
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { copyFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { logValue, unwrapAndLogResult } from "../src/utility/debug";
import type { PipelineDbContext } from "./pipeline.db";

const liveLLM = Bun.argv.includes("--liveLLM");
const liveLLMEnabled = liveLLM || Bun.env.LIVE_LLM === "1";

const fixturePath = resolve(
  import.meta.dir,
  "../edgar_test_files/TSM_2024_Q2.html",
);

let runPipeline: typeof import("../src/pipeline")["runPipeline"];
let createRepo: typeof import("../src/db/repo")["createRepo"];
let PipelineModelSchema: typeof import("../src/pipeline/model")["PipelineModelSchema"];
let dbContext: PipelineDbContext | undefined;

beforeAll(async () => {
  const { setupPipelineDb } = await import("./pipeline.db");
  dbContext = await setupPipelineDb();

  await copyFile(fixturePath, join(dbContext.tempRoot, "TSM_2024_Q2.html"));

  const [pipeline, repo, model] = await Promise.all([
    import("../src/pipeline"),
    import("../src/db/repo"),
    import("../src/pipeline/model"),
  ]);

  runPipeline = pipeline.runPipeline;
  createRepo = repo.createRepo;
  PipelineModelSchema = model.PipelineModelSchema;
});

afterAll(async () => {
  if (dbContext === undefined) {
    return;
  }

  const { teardownPipelineDb } = await import("./pipeline.db");
  await teardownPipelineDb(dbContext);
});

describe("pipeline index full e2e", () => {
  // Run this test in mini mode: `MINI_EXTRACTION=1 LIVE_LLM=1 bun test e2e/pipeline.index.full.test.ts`
  // this stops extraction after 20 tables and 30 paragraphs.
  test.skipIf(!liveLLMEnabled)(
    "runs the full pipeline and persists the output",
    async () => {
      const previousMiniExtraction = Bun.env.MINI_EXTRACTION;
      Bun.env.MINI_EXTRACTION = "1";

      try {
        const context = dbContext;

        if (context === undefined) {
          throw new Error("pipeline db not initialized");
        }

        const workingFolder = context.tempRoot;
        const inputFileName = "TSM_2024_Q2.html";
        const inputPath = join(workingFolder, inputFileName);
        const outputPath = join(workingFolder, "TSM_2024_Q2.pipeline.json");
        const cleanedPath = join(workingFolder, "TSM_2024_Q2_cleaned.html");

        await unwrapAndLogResult(
          runPipeline(workingFolder, inputFileName, context.prisma),
          "pipeline.run",
        );

        expect(await Bun.file(inputPath).exists()).toBe(true);
        expect(await Bun.file(cleanedPath).exists()).toBe(true);
        expect(await Bun.file(outputPath).exists()).toBe(true);

        const output = await Bun.file(outputPath).text();
        const parsed = JSON.parse(output);
        const model = PipelineModelSchema.parse(parsed);
        logValue("pipeline.model", model);

        expect(model.quotes.length).toBeGreaterThan(0);
        expect(model.tables.length).toBeGreaterThan(0);

        const repo = createRepo(context.prisma);
        const persisted = await unwrapAndLogResult(
          repo.getFileGraphByOrgPath(inputPath),
          "repo.getFileGraphByOrgPath",
        );

        expect(persisted).not.toBeNull();
        expect(persisted?.file.orgFilePath).toBe(inputPath);
        expect(persisted?.chunks.length).toBeGreaterThan(0);
        expect(persisted?.tables.length).toBeGreaterThan(0);
        expect(persisted?.chunks[0]?.orderInFile).toBe(0);
        expect(persisted?.tables[0]?.orderInFile).toBe(0);
        expect(parsed).toEqual(model);
      } finally {
        if (previousMiniExtraction === undefined) {
          delete Bun.env.MINI_EXTRACTION;
        } else {
          Bun.env.MINI_EXTRACTION = previousMiniExtraction;
        }
      }
    },
    {
      timeout: 600_000,
    },
  );
});
