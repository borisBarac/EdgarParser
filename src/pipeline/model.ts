import { z } from "zod";
import { GroundingSchema } from "./grounding/model";

const CostSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  inputUsd: z.number(),
  outputUsd: z.number(),
  totalUsd: z.number(),
});

export type Cost = z.infer<typeof CostSchema>;

export const QuoteExtractionItemSchema = z.object({
  type: z.enum(["guidance", "risk", "management_commentary", "other"]),
  statement: z.string(),
  quote: z.string().nullable(),
  grounding: GroundingSchema,
});

export type QuoteExtractionItem = z.infer<typeof QuoteExtractionItemSchema>;

export const QuoteExtractionItemWithCostSchema =
  QuoteExtractionItemSchema.extend({
    cost: CostSchema,
  });

export const QuoteExtractionItemsSchemaWithCost = z.array(
  QuoteExtractionItemWithCostSchema,
);

export type QuoteExtractionItemWithCost = z.infer<
  typeof QuoteExtractionItemWithCostSchema
>;

export type QuoteExtractionItemsWithCost = z.infer<
  typeof QuoteExtractionItemsSchemaWithCost
>;

export const TableExtractionSchema = z.object({
  title: z.string().nullable(),
  currency: z.string().nullable(),
  scale: z.number().nullable(),
  columns: z.array(
    z.object({
      header: z.string(),
    }),
  ),
  rows: z.array(
    z.object({
      label: z.string(),
      values: z.array(
        z.object({
          columnIndex: z.number().int().nonnegative(),
          raw: z.string(),
          numeric: z.number().nullable(),
        }),
      ),
    }),
  ),
  grounding: GroundingSchema,
});

export type TableExtraction = z.infer<typeof TableExtractionSchema>;

export const TableExtractionWithCostSchema = TableExtractionSchema.extend({
  cost: CostSchema,
});

export const TableExtractionItemsSchemaWithCost = z.array(
  TableExtractionWithCostSchema,
);

export type TableExtractionWithCost = z.infer<
  typeof TableExtractionWithCostSchema
>;

export type TableExtractionItemsWithCost = z.infer<
  typeof TableExtractionItemsSchemaWithCost
>;

export const PipelineModelSchema = z.object({
  quotes: QuoteExtractionItemsSchemaWithCost,
  tables: TableExtractionItemsSchemaWithCost,
});

export type PipelineModel = z.infer<typeof PipelineModelSchema>;
