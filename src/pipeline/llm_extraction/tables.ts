import { ok } from "neverthrow";
import { z } from "zod";

import { runStructuredAgent } from "../../agent";
import type { AgentToolContents } from "../../agent/types";
import { logValue } from "../../utility/debug";
import {
  type GroundTableSourceInput,
  groundTableExtractionItem,
} from "../grounding/table_grounding";
import {
  TableExtractionSchema,
  TableExtractionWithCostAndGroundingSchema,
} from "../model";
import { groundItems } from "./grounded_items";

export const TableExtractionItemsSchema = TableExtractionSchema;
export const TableExtractionItemsSchemaWithCostAndGrounding = z.array(
  TableExtractionWithCostAndGroundingSchema,
);

export type TableExtractionItems = z.infer<typeof TableExtractionItemsSchema>;
export type TableExtractionWithCostAndGrounding = z.infer<
  typeof TableExtractionWithCostAndGroundingSchema
>;
export type TableExtractionItemsWithCostAndGrounding = z.infer<
  typeof TableExtractionItemsSchemaWithCostAndGrounding
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
 - If nothing qualifies, return an empty table.`;

export const tableExtractionPrompt = `Extract all qualifying financial tables from the filing using the tools.

Use getExtractionData first. Use GetAdjesonData only if needed.

Return the table items.`;

const logTableExtraction = <T>(label: string, value: T): T =>
  logValue(`--- src/pipeline/llm_extraction/tables.ts: ${label} ---`, value);

export const runTableExtractionAgent = (input: TableExtractionAgentInput) =>
  runStructuredAgent({
    systemPrompt: tableExtractionSystemPrompt,
    prompt: tableExtractionPrompt,
    schema: TableExtractionItemsSchema,
    model: "mini",
    tools: input.tools,
  }).andThen(({ output, cost }) => {
    logTableExtraction("runTableExtractionAgent.output", output);
    logTableExtraction("runTableExtractionAgent.cost", cost);

    return groundItems({
      label: "runTableExtractionAgent",
      items: [output],
      schema: TableExtractionItemsSchemaWithCostAndGrounding,
      describeItem: (item) => ({ title: item.title }),
      groundItem: (item) =>
        input.source === undefined
          ? ok(undefined)
          : groundTableExtractionItem(
              {
                title: item.title,
                currency: item.currency,
                scale: item.scale,
                rows: item.rows,
              },
              input.source,
            ),
      buildItem: (item, grounding) => ({
        ...item,
        grounding,
        cost,
      }),
    });
  });
