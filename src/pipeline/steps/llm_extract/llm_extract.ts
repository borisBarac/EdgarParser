import { ResultAsync } from "neverthrow";
import type { FileGraph } from "../../../db/repo";
import type { GroundingChunkInput } from "../../grounding/quote_grounding";
import type { GroundTableSourceInput } from "../../grounding/table_grounding";
import { runQuoteExtractionAgent } from "../../llm_extraction/quotes";
import { runTableExtractionAgent } from "../../llm_extraction/tables";
import type {
  PipelineModel,
  QuoteExtractionItemsWithCost,
  TableExtractionItemsWithCost,
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

const createAgentInput = (chunkText: string) =>
  ({
    // TODO: wire the real agent initialization and tools.
    tools: {
      companyContextData: "",
      extractionData: chunkText,
      adjesonData: "",
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
          async (table): Promise<TableExtractionItemsWithCost> => {
            const agentInput = {
              ...createAgentInput(table.text),
              source: toTableSourceInput(fileGraph.file.id, table),
            };

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
          async (chunk): Promise<QuoteExtractionItemsWithCost> => {
            const agentInput = {
              ...createAgentInput(chunk.text),
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

      const flattenedQuotes: QuoteExtractionItemsWithCost =
        perChunkQuoteResults;
      const flattenedTables: TableExtractionItemsWithCost =
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
