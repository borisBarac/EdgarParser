import { basename, extname, join } from "node:path";
import { performance } from "node:perf_hooks";
import type { PrismaClient } from "@prisma/client";
import { okAsync, type ResultAsync } from "neverthrow";
import type { FileGraph } from "../db/repo";
import { createRepo } from "../db/repo";
import { cleanHtmlFile } from "../html";
import { logValue } from "../utility/debug";
import type { PipelineExtractionModel, PipelineModel } from "./model";
import { type ChunkStepError, chunk } from "./steps/chunk";
import { llmExtract } from "./steps/llm_extract";
import { type SaveStepError, save } from "./steps/save";
import { addTotalCost } from "./steps/total_cost";

type RunPipelineError = Readonly<
  | {
      readonly type: "clean_failed";
      readonly inputPath: string;
      readonly cause: unknown;
    }
  | {
      readonly type: "chunk_failed";
      readonly inputPath: string;
      readonly cause: ChunkStepError;
    }
  | {
      readonly type: "llm_extract_failed";
      readonly inputPath: string;
      readonly cause: unknown;
    }
  | {
      readonly type: "save_failed";
      readonly outputPath: string;
      readonly cause: SaveStepError;
    }
>;

const outputPathForInput = (workingFolder: string, inputFileName: string) =>
  join(
    workingFolder,
    `${basename(inputFileName, extname(inputFileName))}.pipeline.json`,
  );

const cleanError = (inputPath: string, cause: unknown): RunPipelineError => ({
  type: "clean_failed",
  inputPath,
  cause,
});

const chunkError = (
  inputPath: string,
  cause: ChunkStepError,
): RunPipelineError => ({
  type: "chunk_failed",
  inputPath,
  cause,
});

const llmExtractError = (
  inputPath: string,
  cause: unknown,
): RunPipelineError => ({
  type: "llm_extract_failed",
  inputPath,
  cause,
});

const saveError = (
  outputPath: string,
  cause: SaveStepError,
): RunPipelineError => ({
  type: "save_failed",
  outputPath,
  cause,
});

const elapsedMs = (startedAt: number): number =>
  Number((performance.now() - startedAt).toFixed(1));

const logStep = (
  event: string,
  details: Readonly<Record<string, unknown>>,
): void => {
  logValue(event, details);
};

const withStepLogging = <T, E>(
  step: string,
  details: Readonly<Record<string, unknown>>,
  run: () => ResultAsync<T, E>,
): ResultAsync<T, E> => {
  const startedAt = performance.now();

  logStep(`${step}.start`, details);

  return run()
    .map((value) => {
      logStep(`${step}.ok`, { ...details, durationMs: elapsedMs(startedAt) });

      return value;
    })
    .mapErr((cause) => {
      logStep(`${step}.error`, {
        ...details,
        durationMs: elapsedMs(startedAt),
        cause,
      });

      return cause;
    });
};

export const runPipeline = (
  workingFolder: string,
  inputFileName: string,
  prisma: PrismaClient,
): ResultAsync<void, RunPipelineError> => {
  const inputPath = join(workingFolder, inputFileName);
  const outputPath = outputPathForInput(workingFolder, inputFileName);
  const repo = createRepo(prisma);
  const startedAt = performance.now();

  logStep("pipeline.run.start", { inputPath, outputPath });

  return withStepLogging("pipeline.clean", { inputPath }, () =>
    cleanHtmlFile(inputPath).mapErr((cause) => cleanError(inputPath, cause)),
  )
    .andThen((cleanedFile) =>
      withStepLogging(
        "pipeline.chunk",
        { inputPath, cleanedFilePath: cleanedFile.cleanedFilePath },
        () =>
          chunk(repo, cleanedFile).mapErr((cause) =>
            chunkError(inputPath, cause),
          ),
      ),
    )
    .andThen((fileGraph: FileGraph) =>
      withStepLogging(
        "pipeline.llm_extract",
        {
          inputPath,
          fileId: fileGraph.file.id,
          chunkCount: fileGraph.chunks.length,
          tableCount: fileGraph.tables.length,
        },
        () =>
          llmExtract(fileGraph).mapErr((cause) =>
            llmExtractError(inputPath, cause),
          ),
      ),
    )
    .andThen((model: PipelineExtractionModel) =>
      withStepLogging(
        "pipeline.total_cost",
        {
          quoteCount: model.quotes.length,
          tableCount: model.tables.length,
        },
        () => okAsync(addTotalCost(model)),
      ),
    )
    .andThen((model: PipelineModel) =>
      withStepLogging(
        "pipeline.save",
        {
          outputPath,
          quoteCount: model.quotes.length,
          tableCount: model.tables.length,
        },
        () =>
          save(model, outputPath).mapErr((cause) =>
            saveError(outputPath, cause),
          ),
      ),
    )
    .map((value) => {
      logStep("pipeline.run.ok", {
        inputPath,
        outputPath,
        durationMs: elapsedMs(startedAt),
      });

      return value;
    })
    .mapErr((cause) => {
      logStep("pipeline.run.error", {
        inputPath,
        outputPath,
        durationMs: elapsedMs(startedAt),
        cause,
      });

      return cause;
    });
};

export type { FileGraph } from "../db/repo";
export type { CleanedHtmlFile } from "../html";
export type { PipelineModel } from "./model";
export type { RunPipelineError };
