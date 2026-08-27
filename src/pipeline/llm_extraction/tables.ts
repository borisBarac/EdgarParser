import { z } from "zod";

import { runStructuredAgent } from "../../agent";
import type { AgentToolContents } from "../../agent/types";
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
}>;

export const tableExtractionSystemPrompt = `You extract financial tables from EDGAR filings.

Use the configured tools to inspect the source material before answering.

Return only structured JSON matching the provided schema. No markdown, no commentary, no extra keys.

Rules:
- Single pass: extract all relevant tables in one response.
- Focus on financial statement tables, schedules, rollforwards, and other tabular financial disclosures.
- Preserve the table structure from the filing.
- Do not paraphrase titles, headers, labels, or cell text.
- Keep title, currency, and scale faithful to the source when recoverable.
- Set numeric only when the value is unambiguous after accounting for scale and formatting.
- Keep raw as the exact cell text when recoverable.
- Deduplicate repeated, duplicated, or overlapping tables.
- If nothing qualifies, return an empty array.`;

export const tableExtractionPrompt = `Extract all qualifying financial tables from the filing using the tools.

Return only the array of table items. Each item must have:
- title
- currency
- scale
- columns
- rows
- grounding

Preserve the table exactly as shown in the filing when possible. Do not summarize.`;

export const runTableExtractionAgent = (input: TableExtractionAgentInput) =>
  runStructuredAgent({
    systemPrompt: tableExtractionSystemPrompt,
    prompt: tableExtractionPrompt,
    schema: TableExtractionItemsSchema,
    model: "mini",
    tools: input.tools,
  }).map(
    ({ output, cost }): TableExtractionItemsWithCost =>
      TableExtractionItemsSchemaWithCost.parse(
        output.map((item) => ({
          ...item,
          cost,
        })),
      ),
  );
