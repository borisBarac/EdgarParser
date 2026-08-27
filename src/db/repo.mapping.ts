import type {
  ChunkQueryResult,
  ChunkRecord,
  FileGraph,
  FileGraphQueryResult,
  TableQueryResult,
  TableRecord,
} from "./repo.types";
import { sortByOrderInFile } from "./repo.utils";

export const mapChunkRecord = (chunk: ChunkQueryResult): ChunkRecord => ({
  id: chunk.id,
  fileId: chunk.fileId,
  xpathStart: chunk.xpathStart,
  xpathEnd: chunk.xpathEnd,
  orderInFile: chunk.orderInFile,
  text: chunk.text,
});

export const mapTableRecord = (table: TableQueryResult): TableRecord => ({
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

export const mapFileGraph = (file: FileGraphQueryResult): FileGraph => ({
  file: {
    id: file.id,
    orgFilePath: file.orgFilePath,
    cleanFilePath: file.cleanFilePath,
  },
  chunks: sortByOrderInFile(file.chunks).map(mapChunkRecord),
  tables: sortByOrderInFile(file.tables).map(mapTableRecord),
});
