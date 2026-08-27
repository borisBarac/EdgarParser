import { mapChunkRecord, mapFileGraph } from "./repo.mapping";
import {
  chunkSelect,
  type DbClient,
  type FileGraph,
  fileGraphInclude,
  type NormalizedSaveChunkInput,
  type NormalizedSaveFileGraphInput,
  type NormalizedSaveTableInput,
} from "./repo.types";

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
  chunkByOrderInFile: ReadonlyMap<number, ReturnType<typeof mapChunkRecord>>,
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

export const saveFileGraphTransactional = async (
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
