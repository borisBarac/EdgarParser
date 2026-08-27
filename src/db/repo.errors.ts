import type { RepoError, RepoOperation } from "./repo.types";

export const toDbError = (
  operation: RepoOperation,
  cause: unknown,
): RepoError => ({
  type: "db",
  operation,
  cause,
});

export const toInvalidInputError = (
  field: string,
  message: string,
): RepoError => ({
  type: "invalid_input",
  field,
  message,
});
