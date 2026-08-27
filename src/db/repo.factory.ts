import type { PrismaClient } from "@prisma/client";
import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { toDbError } from "./repo.errors";
import { readFileGraphByWhere } from "./repo.read";
import type { Repo } from "./repo.types";
import { validateSaveFileGraphInput } from "./repo.validation";
import { saveFileGraphTransactional } from "./repo.write";

export type { Repo } from "./repo.types";

export const createRepo = (client: PrismaClient): Repo => ({
  saveFileGraph: (input) =>
    validateSaveFileGraphInput(input).match(
      (validatedInput) =>
        ResultAsync.fromPromise(
          client.$transaction((tx) =>
            saveFileGraphTransactional(tx, validatedInput),
          ),
          (cause) => toDbError("save_file_graph", cause),
        ).andThen((fileGraph) =>
          fileGraph === null
            ? errAsync(
                toDbError(
                  "save_file_graph",
                  new Error("saved file graph was not found after transaction"),
                ),
              )
            : okAsync(fileGraph),
        ),
      (error) => errAsync(error),
    ),
  getFileGraphById: (fileId) =>
    readFileGraphByWhere(client, { id: fileId }, "get_file_graph_by_id"),
  getFileGraphByOrgPath: (orgFilePath) =>
    readFileGraphByWhere(
      client,
      {
        orgFilePath,
      },
      "get_file_graph_by_org_path",
    ),
});
