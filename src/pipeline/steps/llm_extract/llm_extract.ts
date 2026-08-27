import { ResultAsync } from "neverthrow";
import type { FileGraph } from "../../../db/repo";
import { htmlToVisibleText } from "../../../utility/html_text";
import type { GroundingChunkInput } from "../../grounding/quote_grounding";
import type { GroundTableSourceInput } from "../../grounding/table_grounding";
import { runQuoteExtractionAgent } from "../../llm_extraction/quotes";
import { runTableExtractionAgent } from "../../llm_extraction/tables";
import type {
  PipelineExtractionModel,
  QuoteExtractionItemsWithCostAndGrounding,
  TableExtractionItemsWithCostAndGrounding,
} from "../../model";
import { PipelineExtractionModelSchema } from "../../model";

type LlmExtractError = Readonly<{
  readonly type: "llm_extract_failed";
  readonly cause: unknown;
}>;

type ExtractionKind = "quote" | "table";

type ExtractionLocation = Readonly<{
  orderInFile: number;
  xpathStart?: string;
  xpathEnd?: string;
  xpath?: string;
}>;

const formatToolText = (label: string, text: string): string =>
  [label, "```text", text, "```"].join("\n");

const shouldRunExtraction = (text: string): boolean =>
  htmlToVisibleText(text).length >= 200;

const createChunkLookup = (
  chunks: FileGraph["chunks"],
): ReadonlyMap<number, FileGraph["chunks"][number]> =>
  new Map(chunks.map((chunk) => [chunk.orderInFile, chunk] as const));

const getPreviousChunk = (
  chunkByOrderInFile: ReadonlyMap<number, FileGraph["chunks"][number]>,
  orderInFile: number,
): FileGraph["chunks"][number] | undefined =>
  chunkByOrderInFile.get(orderInFile - 1);

const createChunkAgentInput = (
  chunk: FileGraph["chunks"][number],
  previousChunkText: string,
) =>
  ({
    // TODO: wire the real agent initialization and tools.
    tools: {
      extractionData: formatToolText(
        "Current chunk extraction data",
        chunk.text,
      ),
      adjesonData: formatToolText("Previous chunk context", previousChunkText),
    },
  }) as const;

const toGroundingChunks = (
  chunks: readonly {
    readonly id: number;
    readonly orderInFile: number;
    readonly text: string;
    readonly xpathStart: string | undefined;
    readonly xpathEnd: string | undefined;
  }[],
): readonly GroundingChunkInput[] =>
  chunks
    .filter((chunk) => htmlToVisibleText(chunk.text).length > 0)
    .map((chunk) => ({
      id: String(chunk.id),
      orderInFile: chunk.orderInFile,
      text: chunk.text,
      xpathStart: chunk.xpathStart ?? null,
      xpathEnd: chunk.xpathEnd ?? null,
    }));

const toQuoteGroundingChunks = (
  chunk: FileGraph["chunks"][number],
  previousChunk: FileGraph["chunks"][number] | undefined,
): readonly GroundingChunkInput[] =>
  toGroundingChunks([
    chunk,
    ...(previousChunk !== undefined &&
    htmlToVisibleText(previousChunk.text).length > 0
      ? [previousChunk]
      : []),
  ]);

const toTableSourceInput = (
  fileId: number,
  table: FileGraph["tables"][number],
): GroundTableSourceInput => ({
  documentId: String(fileId),
  xpath: table.xpath,
  html: table.text,
});

export const createTableAgentInput = (
  fileId: number,
  table: FileGraph["tables"][number],
) =>
  ({
    tools: {
      extractionData: [
        "Main table extraction data.",
        "This is the primary HTML source to inspect.",
        "```html",
        table.text,
        "```",
      ].join("\n"),
      adjesonData: formatToolText(
        "Previous chunk context",
        table.prevChunk?.text ?? "",
      ),
    },
    source: toTableSourceInput(fileId, table),
  }) as const;

const logExtractionFailure = (
  kind: ExtractionKind,
  item: ExtractionLocation,
): void => {
  console.log(`${kind} extraction failed`, {
    orderInFile: item.orderInFile,
    xpathStart: item.xpathStart,
    xpathEnd: item.xpathEnd,
    xpath: item.xpath,
  });
};

export const runSequentialExtraction = async <TItem, TSource>(
  items: readonly TSource[],
  extractItem: (item: TSource) => Promise<readonly TItem[]>,
): Promise<TItem[]> => {
  const results: TItem[] = [];

  for (const item of items) {
    const itemResult = await extractItem(item);
    results.push(...itemResult);
  }

  return results;
};

export const llmExtract = (
  fileGraph: FileGraph,
): ResultAsync<PipelineExtractionModel, LlmExtractError> =>
  ResultAsync.fromPromise(
    (async () => {
      const isMiniExtractionEnabled = Bun.env.MINI_EXTRACTION === "1";
      const tables = isMiniExtractionEnabled
        ? fileGraph.tables.slice(0, 10)
        : fileGraph.tables;
      const chunks = isMiniExtractionEnabled
        ? fileGraph.chunks.slice(0, 30)
        : fileGraph.chunks;
      const chunkByOrderInFile = createChunkLookup(fileGraph.chunks);

      const runTableExtractionSequentially = () =>
        runSequentialExtraction(
          tables,
          async (table): Promise<TableExtractionItemsWithCostAndGrounding> => {
            if (!shouldRunExtraction(table.text)) {
              return [];
            }

            const agentInput = createTableAgentInput(fileGraph.file.id, table);

            return runTableExtractionAgent(agentInput).match(
              (value) => value,
              () => {
                logExtractionFailure("table", table);

                // TODO: handle failed chunks with a real error/reporting path.
                return [];
              },
            );
          },
        );

      const [perChunkQuoteResults, perChunkTableResults] = await Promise.all([
        runSequentialExtraction(
          chunks,
          async (chunk): Promise<QuoteExtractionItemsWithCostAndGrounding> => {
            if (!shouldRunExtraction(chunk.text)) {
              return [];
            }

            const previousChunk = getPreviousChunk(
              chunkByOrderInFile,
              chunk.orderInFile,
            );
            const previousChunkText = previousChunk?.text ?? "";

            const agentInput = {
              ...createChunkAgentInput(chunk, previousChunkText),
              documentId: String(fileGraph.file.id),
              chunks: toQuoteGroundingChunks(chunk, previousChunk),
            };

            return runQuoteExtractionAgent(agentInput).match(
              (value) => value,
              () => {
                logExtractionFailure("quote", chunk);

                // TODO: handle failed chunks with a real error/reporting path.
                return [];
              },
            );
          },
        ),
        runTableExtractionSequentially(),
      ]);

      const flattenedQuotes: QuoteExtractionItemsWithCostAndGrounding =
        perChunkQuoteResults;
      const flattenedTables: TableExtractionItemsWithCostAndGrounding =
        perChunkTableResults;

      return PipelineExtractionModelSchema.parse({
        quotes: flattenedQuotes,
        tables: flattenedTables,
      });
    })(),
    (cause): LlmExtractError => ({
      type: "llm_extract_failed",
      cause,
    }),
  );
