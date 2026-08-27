import { z } from "zod";
import { GroundingSchema } from "./grounding/model";

export const CostSchema = z.object({
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
});

export type QuoteExtractionItem = z.infer<typeof QuoteExtractionItemSchema>;

export const QuoteExtractionItemWithCostSchema =
  QuoteExtractionItemSchema.extend({
    cost: CostSchema,
  });

export const QuoteExtractionItemWithCostAndGroundingSchema =
  QuoteExtractionItemWithCostSchema.extend({
    grounding: GroundingSchema,
  });

export const QuoteExtractionItemsSchemaWithCostAndGrounding = z.array(
  QuoteExtractionItemWithCostAndGroundingSchema,
);

export type QuoteExtractionItemWithCost = z.infer<
  typeof QuoteExtractionItemWithCostSchema
>;

export type QuoteExtractionItemWithCostAndGrounding = z.infer<
  typeof QuoteExtractionItemWithCostAndGroundingSchema
>;

export type QuoteExtractionItemsWithCostAndGrounding = z.infer<
  typeof QuoteExtractionItemsSchemaWithCostAndGrounding
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
});

export type TableExtraction = z.infer<typeof TableExtractionSchema>;

export const TableExtractionWithCostSchema = TableExtractionSchema.extend({
  cost: CostSchema,
});

export const TableExtractionWithCostAndGroundingSchema =
  TableExtractionWithCostSchema.extend({
    grounding: GroundingSchema,
  });

export const TableExtractionItemsSchemaWithCostAndGrounding = z.array(
  TableExtractionWithCostAndGroundingSchema,
);

export type TableExtractionWithCost = z.infer<
  typeof TableExtractionWithCostSchema
>;

export type TableExtractionWithCostAndGrounding = z.infer<
  typeof TableExtractionWithCostAndGroundingSchema
>;

export type TableExtractionItemsWithCostAndGrounding = z.infer<
  typeof TableExtractionItemsSchemaWithCostAndGrounding
>;

export const PipelineExtractionModelSchema = z.object({
  quotes: QuoteExtractionItemsSchemaWithCostAndGrounding,
  tables: TableExtractionItemsSchemaWithCostAndGrounding,
});

export type PipelineExtractionModel = z.infer<
  typeof PipelineExtractionModelSchema
>;

export const PipelineModelSchema = PipelineExtractionModelSchema.extend({
  totalCost: CostSchema,
});

export type PipelineModel = z.infer<typeof PipelineModelSchema>;
