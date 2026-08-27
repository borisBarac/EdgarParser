import { join, resolve } from "node:path";
import { runPipeline } from "../src/pipeline";
import { logValue } from "../src/utility/debug";
import {
  setupPipelineDb,
  teardownPipelineDb,
} from "../e2e/pipeline.db";

const workingFolder = resolve(import.meta.dir, "../edgar_test_files");
const inputFileName = "TSM_2024_Q2.html";
const outputPath = join(workingFolder, "TSM_2024_Q2.pipeline.json");

const main = async (): Promise<void> => {
  const context = await setupPipelineDb();

  try {
    const result = await runPipeline(workingFolder, inputFileName, context.prisma);

    await result.match(
      () => {
        logValue("TSM.run.ok", { outputPath });
      },
      (error) => {
        logValue("TSM.run.error", error);
        process.exitCode = 1;
      },
    );
  } finally {
    await teardownPipelineDb(context);
  }
};

if (import.meta.main) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
