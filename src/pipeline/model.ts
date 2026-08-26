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

const QuoteExtractionItemSchema = z.object({
  type: z.enum(["guidance", "risk", "management_commentary", "other"]),
  statement: z.string(),
  quote: z.string().nullable(),
  grounding: GroundingSchema,
  cost: CostSchema,
});

export type QuoteExtractionItem = z.infer<typeof QuoteExtractionItemSchema>;

const TableExtractionSchema = z.object({
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
  cost: CostSchema,
});

export type TableExtraction = z.infer<typeof TableExtractionSchema>;

export const PipelineModelSchema = z.object({
  quotes: z.array(QuoteExtractionItemSchema),
  tables: z.array(TableExtractionSchema),
});

export type PipelineModel = z.infer<typeof PipelineModelSchema>;
