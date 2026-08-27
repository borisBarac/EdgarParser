import { okAsync } from "neverthrow";
import { z } from "zod";
import { runStructuredAgent } from "../../agent";
import type { AgentToolContents } from "../../agent/types";
import {
  type GroundingChunkInput,
  groundQuoteExtractionItem,
} from "../grounding/quote_grounding";
import {
  QuoteExtractionItemSchema,
  QuoteExtractionItemWithCostSchema,
} from "../model";

export const QuoteExtractionItemsSchema = z.array(QuoteExtractionItemSchema);
export const QuoteExtractionItemsSchemaWithCost = z.array(
  QuoteExtractionItemWithCostSchema,
);

export type QuoteExtractionItem = z.infer<typeof QuoteExtractionItemSchema>;
export type QuoteExtractionItems = z.infer<typeof QuoteExtractionItemsSchema>;
export type QuoteExtractionItemWithCost = z.infer<
  typeof QuoteExtractionItemWithCostSchema
>;
export type QuoteExtractionItemsWithCost = z.infer<
  typeof QuoteExtractionItemsSchemaWithCost
>;

export type QuoteExtractionAgentInput = Readonly<{
  tools: AgentToolContents;
  documentId?: string;
  chunks?: readonly GroundingChunkInput[];
}>;

export const quoteExtractionSystemPrompt = `You extract data and management quotes from EDGAR narrative prose.

Use the configured tools to inspect the source material before answering.

Return only structured JSON matching the provided schema. No markdown, no commentary, no extra keys.

Rules:
- Single pass: extract all relevant items in one response.
- Focus on narrative prose in forward guidance, risk factors, and management commentary.
- Do not paraphrase.
- Keep statement source-faithful and non-paraphrased.
- Set quote to verbatim source text when the exact span is recoverable.
- Set quote to null only when the exact span cannot be isolated.
- Each item must be a distinct quote or claim.
- Deduplicate overlapping, repeated, or near-duplicate items.
- Use type "guidance" for forward guidance, "risk" for risk factors, "management_commentary" for management discussion, and "other" only if the item is relevant but does not fit the other labels.
- If nothing qualifies, return an empty array.`;

export const quoteExtractionPrompt = `Extract all qualifying narrative prose quotes from the filing using the tools.

Return only the array of quote items. Each item must have:
- type
- statement
- quote
- grounding

Keep statement source-faithful and non-paraphrased. Prefer exact wording from the filing; do not summarize.`;

export const runQuoteExtractionAgent = (input: QuoteExtractionAgentInput) =>
  runStructuredAgent({
    systemPrompt: quoteExtractionSystemPrompt,
    prompt: quoteExtractionPrompt,
    schema: QuoteExtractionItemsSchema,
    model: "mini",
    tools: input.tools,
  }).andThen(({ output, cost }) => {
    const groundedItems = output.map((item) => {
      const grounding =
        input.documentId === undefined || input.chunks === undefined
          ? undefined
          : groundQuoteExtractionItem({
              documentId: input.documentId,
              statement: item.statement,
              quote: item.quote,
              chunks: input.chunks,
            }).match(
              (value) => value,
              (error) => {
                console.log("quote grounding failed", {
                  statement: item.statement,
                  error,
                });

                return undefined;
              },
            );

      return {
        ...item,
        grounding,
        cost,
      };
    });

    return okAsync(QuoteExtractionItemsSchemaWithCost.parse(groundedItems));
  });
