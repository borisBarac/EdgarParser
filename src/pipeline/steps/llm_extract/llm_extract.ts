import { ResultAsync } from "neverthrow";
import type { FileGraph } from "../../../db/repo";
import { htmlToVisibleText } from "../../../utility/html_text";
import type { GroundingChunkInput } from "../../grounding/quote_grounding";
import type { GroundTableSourceInput } from "../../grounding/table_grounding";
import { runQuoteExtractionAgent } from "../../llm_extraction/quotes";
import { runTableExtractionAgent } from "../../llm_extraction/tables";
import type {
  PipelineModel,
  QuoteExtractionItemsWithCostAndGrounding,
  TableExtractionItemsWithCostAndGrounding,
} from "../../model";
import { PipelineModelSchema } from "../../model";

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

const findPreviousChunkText = (
  chunks: FileGraph["chunks"],
  orderInFile: number,
): string =>
  chunks.find((chunk) => chunk.orderInFile === orderInFile - 1)?.text ?? "";

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
  chunks: FileGraph["chunks"],
): readonly GroundingChunkInput[] =>
  chunks.map((chunk) => ({
    id: String(chunk.id),
    orderInFile: chunk.orderInFile,
    text: chunk.text,
    xpathStart: chunk.xpathStart,
    xpathEnd: chunk.xpathEnd,
  }));

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
): ResultAsync<PipelineModel, LlmExtractError> =>
  ResultAsync.fromPromise(
    (async () => {
      const runTableExtractionSequentially = () =>
        runSequentialExtraction(
          fileGraph.tables,
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
          fileGraph.chunks,
          async (chunk): Promise<QuoteExtractionItemsWithCostAndGrounding> => {
            if (!shouldRunExtraction(chunk.text)) {
              return [];
            }

            const previousChunkText = findPreviousChunkText(
              fileGraph.chunks,
              chunk.orderInFile,
            );

            const agentInput = {
              ...createChunkAgentInput(chunk, previousChunkText),
              documentId: String(fileGraph.file.id),
              chunks: toGroundingChunks(fileGraph.chunks),
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

      return PipelineModelSchema.parse({
        quotes: flattenedQuotes,
        tables: flattenedTables,
      });
    })(),
    (cause): LlmExtractError => ({
      type: "llm_extract_failed",
      cause,
    }),
  );
