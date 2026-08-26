import { z } from "zod";

export const GroundingSchema = z
  .object({
    documentId: z.string(),
    chunks: z.array(
      z.object({
        id: z.string(),
        chunkXpathStart: z.string().nullable(),
        chunkXpathEnd: z.string().nullable(),
      }),
    ),
    score: z.object({
      bm25: z.number(),
      jaroWinkler: z.number(),
    }),
  })
  .optional();

export type Grounding = z.infer<typeof GroundingSchema>;
