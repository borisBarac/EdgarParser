import { basename, extname, join } from "node:path";
import type { PrismaClient } from "@prisma/client";
import type { ResultAsync } from "neverthrow";
import type { FileGraph } from "../db/repo";
import { createRepo } from "../db/repo";
import type { PipelineModel } from "./model";
import { type ChunkStepError, chunk } from "./steps/chunk";
import { clean } from "./steps/clean";
import { llmExtract } from "./steps/llm_extract";
import { type SaveStepError, save } from "./steps/save";

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

export const runPipeline = (
  workingFolder: string,
  inputFileName: string,
  prisma: PrismaClient,
): ResultAsync<void, RunPipelineError> => {
  const inputPath = join(workingFolder, inputFileName);
  const outputPath = outputPathForInput(workingFolder, inputFileName);
  const repo = createRepo(prisma);

  return clean(inputPath)
    .mapErr((cause) => cleanError(inputPath, cause))
    .andThen((cleanedFile) =>
      chunk(repo, cleanedFile).mapErr((cause) => chunkError(inputPath, cause)),
    )
    .andThen((fileGraph: FileGraph) =>
      llmExtract(fileGraph).mapErr((cause) =>
        llmExtractError(inputPath, cause),
      ),
    )
    .andThen((model: PipelineModel) =>
      save(model, outputPath).mapErr((cause) => saveError(outputPath, cause)),
    );
};

export type { FileGraph } from "../db/repo";
export type { CleanedHtmlFile } from "../html";
export type { PipelineModel } from "./model";
export type { RunPipelineError };
