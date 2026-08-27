import type { Prisma, PrismaClient } from "@prisma/client";

export type DbClient = PrismaClient | Prisma.TransactionClient;

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

export type NormalizedSaveChunkInput = Readonly<{
  readonly xpathStart: string;
  readonly xpathEnd: string;
  readonly orderInFile: number;
  readonly text: string;
}>;

export type NormalizedSaveTableInput = Readonly<{
  readonly xpath: string;
  readonly orderInFile: number;
  readonly text: string;
  readonly prevChunkOrderInFile: number | null;
  readonly nextChunkOrderInFile: number | null;
}>;

export type NormalizedSaveFileGraphInput = Readonly<{
  readonly orgFilePath: string;
  readonly cleanFilePath: string;
  readonly chunks: readonly NormalizedSaveChunkInput[];
  readonly tables: readonly NormalizedSaveTableInput[];
}>;

export const chunkSelect = {
  id: true,
  fileId: true,
  xpathStart: true,
  xpathEnd: true,
  orderInFile: true,
  text: true,
} as const;

export const tableInclude = {
  prevChunk: {
    select: chunkSelect,
  },
  nextChunk: {
    select: chunkSelect,
  },
} as const;

export const fileGraphInclude = {
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

export type FileGraphQueryResult = Prisma.FileGetPayload<{
  include: typeof fileGraphInclude;
}>;

export type ChunkQueryResult = Prisma.ChunkGetPayload<{
  select: typeof chunkSelect;
}>;

export type TableQueryResult = Prisma.FilingTableGetPayload<{
  include: typeof tableInclude;
}>;

export type Repo = Readonly<{
  readonly saveFileGraph: (
    input: SaveFileGraphInput,
  ) => import("neverthrow").ResultAsync<FileGraph, RepoError>;
  readonly getFileGraphById: (
    fileId: number,
  ) => import("neverthrow").ResultAsync<FileGraph | null, RepoError>;
  readonly getFileGraphByOrgPath: (
    orgFilePath: string,
  ) => import("neverthrow").ResultAsync<FileGraph | null, RepoError>;
}>;
