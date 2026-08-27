import { ok } from "neverthrow";
import { z } from "zod";
import { runStructuredAgent } from "../../agent";
import type { AgentToolContents } from "../../agent/types";
import { logValue } from "../../utility/debug";
import {
  type GroundingChunkInput,
  groundQuoteExtractionItem,
} from "../grounding/quote_grounding";
import {
  QuoteExtractionItemSchema,
  QuoteExtractionItemWithCostAndGroundingSchema,
} from "../model";
import { groundItems } from "./grounded_items";

export const QuoteExtractionItemsSchema = z.object({
  items: z.array(QuoteExtractionItemSchema),
});
export const QuoteExtractionItemsArraySchema = z.array(
  QuoteExtractionItemSchema,
);
export const QuoteExtractionItemsSchemaWithCostAndGrounding = z.array(
  QuoteExtractionItemWithCostAndGroundingSchema,
);

export type QuoteExtractionItem = z.infer<typeof QuoteExtractionItemSchema>;
export type QuoteExtractionItems = z.infer<
  typeof QuoteExtractionItemsArraySchema
>;
export type QuoteExtractionItemWithCostAndGrounding = z.infer<
  typeof QuoteExtractionItemWithCostAndGroundingSchema
>;
export type QuoteExtractionItemsWithCostAndGrounding = z.infer<
  typeof QuoteExtractionItemsSchemaWithCostAndGrounding
>;

export type QuoteExtractionAgentInput = Readonly<{
  tools: AgentToolContents;
  documentId?: string;
  chunks?: readonly GroundingChunkInput[];
}>;

export const quoteExtractionSystemPrompt = `You extract data and management quotes from EDGAR narrative prose.

Rules:
- Use the configured tools to inspect the source material before answering.
- Focus on narrative prose in forward guidance, risk factors, and management commentary.
- Do not paraphrase.
- Keep statement source-faithful and non-paraphrased.
- Set quote to verbatim source text when the exact span is recoverable.
- Set quote to null only when the exact span cannot be isolated.
- Each item must be a distinct quote or claim.
- Deduplicate overlapping, repeated, or near-duplicate items.
- Use type "guidance" for forward guidance, "risk" for risk factors, "management_commentary" for management discussion, and "other" only if the item is relevant but does not fit the other labels.
- If nothing qualifies, return { items: [] }.`;

export const quoteExtractionPrompt = `Extract all qualifying narrative prose quotes from the filing using the tools.

Use getExtractionData first. Use GetAdjesonData only if needed.

Return { items: [...] }.`;

const logQuoteExtraction = <T>(label: string, value: T): T =>
  logValue(`--- src/pipeline/llm_extraction/quotes.ts: ${label} ---`, value);

export const runQuoteExtractionAgent = (input: QuoteExtractionAgentInput) =>
  runStructuredAgent({
    systemPrompt: quoteExtractionSystemPrompt,
    prompt: quoteExtractionPrompt,
    schema: QuoteExtractionItemsSchema,
    model: "mini",
    tools: input.tools,
  }).andThen(({ output, cost }) => {
    logQuoteExtraction("runQuoteExtractionAgent.output", output);
    logQuoteExtraction("runQuoteExtractionAgent.cost", cost);

    return groundItems({
      label: "runQuoteExtractionAgent",
      items: output.items,
      schema: QuoteExtractionItemsSchemaWithCostAndGrounding,
      describeItem: (item) => ({ statement: item.statement }),
      groundItem: (item) =>
        input.documentId === undefined || input.chunks === undefined
          ? ok(undefined)
          : groundQuoteExtractionItem({
              documentId: input.documentId,
              statement: item.statement,
              quote: item.quote,
              chunks: input.chunks,
            }),
      buildItem: (item, grounding) => ({
        ...item,
        grounding,
        cost,
      }),
    });
  });
