import { ResultAsync } from "neverthrow";
import type { FileGraph } from "../../db/repo";
import { runQuoteExtractionAgent } from "../llm_extraction/quotes";
import { runTableExtractionAgent } from "../llm_extraction/tables";
import type {
  PipelineModel,
  QuoteExtractionItemsWithCost,
  TableExtractionItemsWithCost,
} from "../model";
import { PipelineModelSchema } from "../model";

type LlmExtractError = Readonly<{
  readonly type: "llm_extract_failed";
  readonly cause: unknown;
}>;

type ExtractionKind = "quote" | "table";

const createAgentInput = (chunkText: string) =>
  ({
    // TODO: wire the real agent initialization and tools.
    tools: {
      companyContextData: "",
      extractionData: chunkText,
      adjesonData: "",
    },
  }) as const;

const logExtractionFailure = (
  kind: ExtractionKind,
  chunk: FileGraph["chunks"][number],
): void => {
  console.log(`${kind} extraction failed for chunk`, {
    orderInFile: chunk.orderInFile,
    xpathStart: chunk.xpathStart,
    xpathEnd: chunk.xpathEnd,
  });
};

export const runSequentialExtraction = async <TItem>(
  chunks: FileGraph["chunks"],
  extractChunk: (
    chunk: FileGraph["chunks"][number],
  ) => Promise<readonly TItem[]>,
): Promise<TItem[]> => {
  const results: TItem[] = [];

  for (const chunk of chunks) {
    const chunkResult = await extractChunk(chunk);
    results.push(...chunkResult);
  }

  return results;
};

export const llmExtract = (
  fileGraph: FileGraph,
): ResultAsync<PipelineModel, LlmExtractError> =>
  ResultAsync.fromPromise(
    (async () => {
      const runQuoteExtractionSequentially = () =>
        runSequentialExtraction(
          fileGraph.chunks,
          async (chunk): Promise<QuoteExtractionItemsWithCost> => {
            const agentInput = createAgentInput(chunk.text);

            return runQuoteExtractionAgent(agentInput).match(
              (value) => value,
              () => {
                logExtractionFailure("quote", chunk);

                // TODO: handle failed chunks with a real error/reporting path.
                return [];
              },
            );
          },
        );

      const runTableExtractionSequentially = () =>
        runSequentialExtraction(
          fileGraph.chunks,
          async (chunk): Promise<TableExtractionItemsWithCost> => {
            const agentInput = createAgentInput(chunk.text);

            return runTableExtractionAgent(agentInput).match(
              (value) => value,
              () => {
                logExtractionFailure("table", chunk);

                // TODO: handle failed chunks with a real error/reporting path.
                return [];
              },
            );
          },
        );

      const [perChunkQuoteResults, perChunkTableResults] = await Promise.all([
        runQuoteExtractionSequentially(),
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
