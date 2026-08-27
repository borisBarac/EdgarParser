import type { ResultAsync } from "neverthrow";
import { type FileManagerError, writeFile } from "../../utility/file_manager";
import type { PipelineModel } from "../model";

export type SaveStepError = Readonly<{
  readonly type: "save_pipeline_model_failed";
  readonly path: string;
  readonly cause: FileManagerError;
}>;

const savePipelineModelError = (
  path: string,
  cause: FileManagerError,
): SaveStepError => ({
  type: "save_pipeline_model_failed",
  path,
  cause,
});

export const save = (
  model: PipelineModel,
  path: string,
): ResultAsync<void, SaveStepError> =>
  writeFile(path, JSON.stringify(model, null, 2))
    .map(() => undefined)
    .mapErr((cause) => savePipelineModelError(path, cause));
