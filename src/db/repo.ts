import type { Prisma, PrismaClient } from "@prisma/client";
import {
  err,
  errAsync,
  ok,
  okAsync,
  type Result,
  ResultAsync,
} from "neverthrow";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type RepoOperation =
  | "save_file_graph"
  | "get_file_graph_by_id"
  | "get_file_graph_by_org_path";

export type RepoError =
  | Readonly<{
      readonly type: "db";
      readonly operation: RepoOperation;
      readonly cause: unknown;
    }>
  | Readonly<{
      readonly type: "invalid_input";
      readonly field: string;
      readonly message: string;
    }>
  | Readonly<{
      readonly type: "duplicate_chunk_order";
      readonly orderInFile: number;
    }>
  | Readonly<{
      readonly type: "duplicate_table_order";
      readonly orderInFile: number;
    }>
  | Readonly<{
      readonly type: "missing_chunk_reference";
      readonly tableOrderInFile: number;
      readonly reference: "prev" | "next";
      readonly missingOrderInFile: number;
    }>;

export type SaveChunkInput = Readonly<{
  readonly xpathStart: string;
  readonly xpathEnd: string;
  readonly orderInFile: number;
  readonly text: string;
}>;

export type SaveTableInput = Readonly<{
  readonly xpath: string;
  readonly orderInFile: number;
  readonly text: string;
  readonly prevChunkOrderInFile: number | null;
  readonly nextChunkOrderInFile: number | null;
}>;

export type SaveFileGraphInput = Readonly<{
  readonly orgFilePath: string;
  readonly cleanFilePath: string;
  readonly chunks: readonly SaveChunkInput[];
  readonly tables: readonly SaveTableInput[];
}>;

export type ChunkRecord = Readonly<{
  readonly id: number;
  readonly fileId: number;
  readonly xpathStart: string;
  readonly xpathEnd: string;
  readonly orderInFile: number;
  readonly text: string;
}>;

export type TableRecord = Readonly<{
  readonly id: number;
  readonly fileId: number;
  readonly xpath: string;
  readonly orderInFile: number;
  readonly text: string;
  readonly prevChunkId: number | null;
  readonly prevChunkFileId: number | null;
  readonly nextChunkId: number | null;
  readonly nextChunkFileId: number | null;
  readonly prevChunk: ChunkRecord | null;
  readonly nextChunk: ChunkRecord | null;
}>;

export type FileRecord = Readonly<{
  readonly id: number;
  readonly orgFilePath: string;
  readonly cleanFilePath: string;
}>;

export type FileGraph = Readonly<{
  readonly file: FileRecord;
  readonly chunks: readonly ChunkRecord[];
  readonly tables: readonly TableRecord[];
}>;

type NormalizedSaveChunkInput = Readonly<{
  readonly xpathStart: string;
  readonly xpathEnd: string;
  readonly orderInFile: number;
  readonly text: string;
}>;

type NormalizedSaveTableInput = Readonly<{
  readonly xpath: string;
  readonly orderInFile: number;
  readonly text: string;
  readonly prevChunkOrderInFile: number | null;
  readonly nextChunkOrderInFile: number | null;
}>;

type NormalizedSaveFileGraphInput = Readonly<{
  readonly orgFilePath: string;
  readonly cleanFilePath: string;
  readonly chunks: readonly NormalizedSaveChunkInput[];
  readonly tables: readonly NormalizedSaveTableInput[];
}>;

const chunkSelect = {
  id: true,
  fileId: true,
  xpathStart: true,
  xpathEnd: true,
  orderInFile: true,
  text: true,
} as const;

const tableInclude = {
  prevChunk: {
    select: chunkSelect,
  },
  nextChunk: {
    select: chunkSelect,
  },
} as const;

const fileGraphInclude = {
  chunks: {
    orderBy: {
      orderInFile: "asc",
    },
  },
  tables: {
    orderBy: {
      orderInFile: "asc",
    },
    include: tableInclude,
  },
} as const;

type FileGraphQueryResult = Prisma.FileGetPayload<{
  include: typeof fileGraphInclude;
}>;

type ChunkQueryResult = Prisma.ChunkGetPayload<{
  select: typeof chunkSelect;
}>;

type TableQueryResult = Prisma.FilingTableGetPayload<{
  include: typeof tableInclude;
}>;

const toDbError = (operation: RepoOperation, cause: unknown): RepoError => ({
  type: "db",
  operation,
  cause,
});

const toInvalidInputError = (field: string, message: string): RepoError => ({
  type: "invalid_input",
  field,
  message,
});

const sortByOrderInFile = <T extends { readonly orderInFile: number }>(
  values: readonly T[],
): readonly T[] =>
  [...values].sort((left, right) => left.orderInFile - right.orderInFile);

const validateOrder = (
  field: string,
  value: number,
): Result<number, RepoError> => {
  if (!Number.isInteger(value) || value < 0) {
    return err(toInvalidInputError(field, "must be a non-negative integer."));
  }

  return ok(value);
};

const validateTrimmedField = (
  field: string,
  value: string,
): Result<string, RepoError> => {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return err(toInvalidInputError(field, "must be a non-empty string."));
  }

  return ok(trimmed);
};

const validatePreservedField = (
  field: string,
  value: string,
): Result<string, RepoError> => {
  if (value.trim().length === 0) {
    return err(toInvalidInputError(field, "must be a non-empty string."));
  }

  return ok(value);
};

const validateNullableOrder = (
  field: string,
  value: number | null,
): Result<number | null, RepoError> => {
  if (value === null) {
    return ok(null);
  }

  return validateOrder(field, value);
};

const validateUniqueOrders = <T extends { readonly orderInFile: number }>(
  items: readonly T[],
  duplicateError: (orderInFile: number) => RepoError,
): Result<void, RepoError> => {
  const seen = new Set<number>();

  for (const item of items) {
    if (seen.has(item.orderInFile)) {
      return err(duplicateError(item.orderInFile));
    }

    seen.add(item.orderInFile);
  }

  return ok(undefined);
};

const validateSaveFileGraphInput = (
  input: SaveFileGraphInput,
): Result<NormalizedSaveFileGraphInput, RepoError> => {
  const normalizedOrgFilePath = validatePreservedField(
    "orgFilePath",
    input.orgFilePath,
  );

  if (normalizedOrgFilePath.isErr()) {
    return err(normalizedOrgFilePath.error);
  }

  const normalizedCleanFilePath = validatePreservedField(
    "cleanFilePath",
    input.cleanFilePath,
  );

  if (normalizedCleanFilePath.isErr()) {
    return err(normalizedCleanFilePath.error);
  }

  const normalizedChunks: NormalizedSaveChunkInput[] = [];

  for (const [index, chunk] of sortByOrderInFile(input.chunks).entries()) {
    const orderInFile = validateOrder(
      `chunks[${index}].orderInFile`,
      chunk.orderInFile,
    );

    if (orderInFile.isErr()) {
      return err(orderInFile.error);
    }

    const xpathStart = validateTrimmedField(
      `chunks[${index}].xpathStart`,
      chunk.xpathStart,
    );

    if (xpathStart.isErr()) {
      return err(xpathStart.error);
    }

    const xpathEnd = validateTrimmedField(
      `chunks[${index}].xpathEnd`,
      chunk.xpathEnd,
    );

    if (xpathEnd.isErr()) {
      return err(xpathEnd.error);
    }

    const text = validatePreservedField(`chunks[${index}].text`, chunk.text);

    if (text.isErr()) {
      return err(text.error);
    }

    normalizedChunks.push({
      xpathStart: xpathStart.value,
      xpathEnd: xpathEnd.value,
      orderInFile: orderInFile.value,
      text: text.value,
    });
  }

  const chunkOrderValidation = validateUniqueOrders(
    normalizedChunks,
    (orderInFile) => ({ type: "duplicate_chunk_order", orderInFile }),
  );

  if (chunkOrderValidation.isErr()) {
    return err(chunkOrderValidation.error);
  }

  const chunkOrders = new Set(
    normalizedChunks.map((chunk) => chunk.orderInFile),
  );

  const normalizedTables: NormalizedSaveTableInput[] = [];

  for (const [index, table] of sortByOrderInFile(input.tables).entries()) {
    const orderInFile = validateOrder(
      `tables[${index}].orderInFile`,
      table.orderInFile,
    );

    if (orderInFile.isErr()) {
      return err(orderInFile.error);
    }

    const xpath = validateTrimmedField(`tables[${index}].xpath`, table.xpath);

    if (xpath.isErr()) {
      return err(xpath.error);
    }

    const text = validatePreservedField(`tables[${index}].text`, table.text);

    if (text.isErr()) {
      return err(text.error);
    }

    const prevChunkOrderInFile = validateNullableOrder(
      `tables[${index}].prevChunkOrderInFile`,
      table.prevChunkOrderInFile,
    );

    if (prevChunkOrderInFile.isErr()) {
      return err(prevChunkOrderInFile.error);
    }

    const nextChunkOrderInFile = validateNullableOrder(
      `tables[${index}].nextChunkOrderInFile`,
      table.nextChunkOrderInFile,
    );

    if (nextChunkOrderInFile.isErr()) {
      return err(nextChunkOrderInFile.error);
    }

    normalizedTables.push({
      xpath: xpath.value,
      orderInFile: orderInFile.value,
      text: text.value,
      prevChunkOrderInFile: prevChunkOrderInFile.value,
      nextChunkOrderInFile: nextChunkOrderInFile.value,
    });
  }

  const tableOrderValidation = validateUniqueOrders(
    normalizedTables,
    (orderInFile) => ({ type: "duplicate_table_order", orderInFile }),
  );

  if (tableOrderValidation.isErr()) {
    return err(tableOrderValidation.error);
  }

  for (const table of normalizedTables) {
    if (
      table.prevChunkOrderInFile !== null &&
      !chunkOrders.has(table.prevChunkOrderInFile)
    ) {
      return err({
        type: "missing_chunk_reference",
        tableOrderInFile: table.orderInFile,
        reference: "prev",
        missingOrderInFile: table.prevChunkOrderInFile,
      });
    }

    if (
      table.nextChunkOrderInFile !== null &&
      !chunkOrders.has(table.nextChunkOrderInFile)
    ) {
      return err({
        type: "missing_chunk_reference",
        tableOrderInFile: table.orderInFile,
        reference: "next",
        missingOrderInFile: table.nextChunkOrderInFile,
      });
    }
  }

  return ok({
    orgFilePath: normalizedOrgFilePath.value,
    cleanFilePath: normalizedCleanFilePath.value,
    chunks: normalizedChunks,
    tables: normalizedTables,
  });
};

const mapChunkRecord = (chunk: ChunkQueryResult): ChunkRecord => ({
  id: chunk.id,
  fileId: chunk.fileId,
  xpathStart: chunk.xpathStart,
  xpathEnd: chunk.xpathEnd,
  orderInFile: chunk.orderInFile,
  text: chunk.text,
});

const mapTableRecord = (table: TableQueryResult): TableRecord => ({
  id: table.id,
  fileId: table.fileId,
  xpath: table.xpath,
  orderInFile: table.orderInFile,
  text: table.text,
  prevChunkId: table.prevChunkId,
  prevChunkFileId: table.prevChunkFileId,
  nextChunkId: table.nextChunkId,
  nextChunkFileId: table.nextChunkFileId,
  prevChunk: table.prevChunk ? mapChunkRecord(table.prevChunk) : null,
  nextChunk: table.nextChunk ? mapChunkRecord(table.nextChunk) : null,
});

const mapFileGraph = (file: FileGraphQueryResult): FileGraph => ({
  file: {
    id: file.id,
    orgFilePath: file.orgFilePath,
    cleanFilePath: file.cleanFilePath,
  },
  chunks: sortByOrderInFile(file.chunks).map(mapChunkRecord),
  tables: sortByOrderInFile(file.tables).map(mapTableRecord),
});

const readFileGraphByWhere = (
  client: DbClient,
  where: Prisma.FileWhereUniqueInput,
  operation: Exclude<RepoOperation, "save_file_graph">,
): ResultAsync<FileGraph | null, RepoError> =>
  ResultAsync.fromPromise(
    client.file.findUnique({
      where,
      include: fileGraphInclude,
    }),
    (cause) => toDbError(operation, cause),
  ).map((file) => (file === null ? null : mapFileGraph(file)));

const createChunkRows = (
  fileId: number,
  chunks: readonly NormalizedSaveChunkInput[],
) =>
  chunks.map((chunk) => ({
    fileId,
    xpathStart: chunk.xpathStart,
    xpathEnd: chunk.xpathEnd,
    orderInFile: chunk.orderInFile,
    text: chunk.text,
  }));

const createTableRows = (
  fileId: number,
  chunkByOrderInFile: ReadonlyMap<number, ChunkRecord>,
  tables: readonly NormalizedSaveTableInput[],
) =>
  tables.map((table) => ({
    fileId,
    xpath: table.xpath,
    orderInFile: table.orderInFile,
    text: table.text,
    prevChunkId:
      table.prevChunkOrderInFile === null
        ? null
        : (chunkByOrderInFile.get(table.prevChunkOrderInFile)?.id ?? null),
    prevChunkFileId:
      table.prevChunkOrderInFile === null
        ? null
        : (chunkByOrderInFile.get(table.prevChunkOrderInFile)?.fileId ?? null),
    nextChunkId:
      table.nextChunkOrderInFile === null
        ? null
        : (chunkByOrderInFile.get(table.nextChunkOrderInFile)?.id ?? null),
    nextChunkFileId:
      table.nextChunkOrderInFile === null
        ? null
        : (chunkByOrderInFile.get(table.nextChunkOrderInFile)?.fileId ?? null),
  }));

const saveFileGraphTransactional = async (
  client: DbClient,
  input: NormalizedSaveFileGraphInput,
): Promise<FileGraph | null> => {
  const existingFile = await client.file.findUnique({
    where: {
      orgFilePath: input.orgFilePath,
    },
  });

  if (existingFile !== null) {
    await client.file.delete({
      where: {
        id: existingFile.id,
      },
    });
  }

  const createdFile = await client.file.create({
    data: {
      orgFilePath: input.orgFilePath,
      cleanFilePath: input.cleanFilePath,
    },
  });

  if (input.chunks.length > 0) {
    await client.chunk.createMany({
      data: createChunkRows(createdFile.id, input.chunks),
    });
  }

  const createdChunks =
    input.chunks.length === 0
      ? []
      : await client.chunk.findMany({
          where: {
            fileId: createdFile.id,
          },
          orderBy: {
            orderInFile: "asc",
          },
          select: chunkSelect,
        });

  const chunkByOrderInFile = new Map(
    createdChunks.map(
      (chunk) => [chunk.orderInFile, mapChunkRecord(chunk)] as const,
    ),
  );

  if (input.tables.length > 0) {
    await client.filingTable.createMany({
      data: createTableRows(createdFile.id, chunkByOrderInFile, input.tables),
    });
  }

  const savedFile = await client.file.findUnique({
    where: {
      id: createdFile.id,
    },
    include: fileGraphInclude,
  });

  return savedFile === null ? null : mapFileGraph(savedFile);
};

export type Repo = Readonly<{
  readonly saveFileGraph: (
    input: SaveFileGraphInput,
  ) => ResultAsync<FileGraph, RepoError>;
  readonly getFileGraphById: (
    fileId: number,
  ) => ResultAsync<FileGraph | null, RepoError>;
  readonly getFileGraphByOrgPath: (
    orgFilePath: string,
  ) => ResultAsync<FileGraph | null, RepoError>;
}>;

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
