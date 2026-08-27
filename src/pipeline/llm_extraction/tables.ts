import { okAsync } from "neverthrow";
import { z } from "zod";

import { runStructuredAgent } from "../../agent";
import type { AgentToolContents } from "../../agent/types";
import {
  type GroundTableSourceInput,
  groundTableExtractionItem,
} from "../grounding/table_grounding";
import { TableExtractionSchema, TableExtractionWithCostSchema } from "../model";

export const TableExtractionItemsSchema = z.array(TableExtractionSchema);
export const TableExtractionItemsSchemaWithCost = z.array(
  TableExtractionWithCostSchema,
);

export type TableExtractionItems = z.infer<typeof TableExtractionItemsSchema>;
export type TableExtractionWithCost = z.infer<
  typeof TableExtractionWithCostSchema
>;
export type TableExtractionItemsWithCost = z.infer<
  typeof TableExtractionItemsSchemaWithCost
>;

export type TableExtractionAgentInput = Readonly<{
  tools: AgentToolContents;
  source?: GroundTableSourceInput;
}>;

export const tableExtractionSystemPrompt = `You extract financial tables from EDGAR filings.

Rules:
- Use the configured tools to inspect the source material before answering.
- Focus on financial statement tables, schedules, rollforwards, and other tabular financial disclosures.
- Preserve the table structure from the filing.
- Do not paraphrase titles, headers, labels, or cell text.
- Keep title, currency, and scale faithful to the source when recoverable.
- Set numeric only when the value is unambiguous after accounting for scale and formatting.
- Keep raw as the exact cell text when recoverable.
- Deduplicate repeated, duplicated, or overlapping tables.
- If nothing qualifies, return an empty array.`;

export const tableExtractionPrompt = `Extract all qualifying financial tables from the filing using the tools.

Use getExtractionData first. Use GetAdjesonData only if needed.

Return the table items.`;

export const runTableExtractionAgent = (input: TableExtractionAgentInput) =>
  runStructuredAgent({
    systemPrompt: tableExtractionSystemPrompt,
    prompt: tableExtractionPrompt,
    schema: TableExtractionItemsSchema,
    model: "mini",
    tools: input.tools,
  }).andThen(({ output, cost }) => {
    const groundedItems = output.map((item) => {
      const grounding =
        input.source === undefined
          ? undefined
          : groundTableExtractionItem(
              {
                title: item.title,
                currency: item.currency,
                scale: item.scale,
                rows: item.rows,
              },
              input.source,
            ).match(
              (value) => value,
              (error) => {
                console.log("table grounding failed", {
                  title: item.title,
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

    return okAsync(TableExtractionItemsSchemaWithCost.parse(groundedItems));
  });
