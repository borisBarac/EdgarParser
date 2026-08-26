import { mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { ResultAsync } from "neverthrow";

export type FileManagerError = Readonly<{
  readonly type: "list_files" | "read_file" | "write_file";
  readonly path: string;
  readonly cause: unknown;
}>;

const toError = (
  type: FileManagerError["type"],
  path: string,
  cause: unknown,
): FileManagerError => ({ type, path, cause });

const listDirectoryFiles = async (
  directoryPath: string,
): Promise<readonly string[]> => {
  const files: string[] = [];

  // Bun.Glob("*") does not include dotfiles by default.
  for await (const relativePath of new Bun.Glob("*").scan(directoryPath)) {
    const filePath = resolve(directoryPath, relativePath);
    const fileStat = await stat(filePath);

    if (fileStat.isFile()) {
      files.push(filePath);
    }
  }

  return files;
};

const ensureParentDirectory = (
  filePath: string,
): ResultAsync<void, FileManagerError> =>
  ResultAsync.fromPromise(
    mkdir(dirname(filePath), { recursive: true }),
    (cause) => toError("write_file", filePath, cause),
  ).map(() => undefined);

export const listFiles = (
  directoryPath: string,
): ResultAsync<readonly string[], FileManagerError> =>
  ResultAsync.fromPromise(listDirectoryFiles(directoryPath), (cause) =>
    toError("list_files", directoryPath, cause),
  );

export const readFile = (
  filePath: string,
): ResultAsync<string, FileManagerError> =>
  ResultAsync.fromPromise(Bun.file(filePath).text(), (cause) =>
    toError("read_file", filePath, cause),
  );

export const writeFile = (
  filePath: string,
  contents: string,
): ResultAsync<number, FileManagerError> =>
  ensureParentDirectory(filePath).andThen(() =>
    ResultAsync.fromPromise(Bun.write(filePath, contents), (cause) =>
      toError("write_file", filePath, cause),
    ),
  );
