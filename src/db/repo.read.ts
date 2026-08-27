import type { Prisma } from "@prisma/client";
import { ResultAsync } from "neverthrow";
import { toDbError } from "./repo.errors";
import { mapFileGraph } from "./repo.mapping";
import {
  type DbClient,
  type FileGraph,
  fileGraphInclude,
  type RepoError,
} from "./repo.types";

export const readFileGraphByWhere = (
  client: DbClient,
  where: Prisma.FileWhereUniqueInput,
  operation: "get_file_graph_by_id" | "get_file_graph_by_org_path",
): ResultAsync<FileGraph | null, RepoError> =>
  ResultAsync.fromPromise(
    client.file.findUnique({
      where,
      include: fileGraphInclude,
    }),
    (cause) => toDbError(operation, cause),
  ).map((file) => (file === null ? null : mapFileGraph(file)));
