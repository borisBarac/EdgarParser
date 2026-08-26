## My general idea about extaction model, this is not a spec, but a idea, do not treat it like a specification


## Grounding Model
```ts
type Grounding = {
	chunks: Array<{
		id: string;
		chunkXpathStart: string | null;
		chunkXpathEnd: string | null;
	}>;
	documentId: string;
	score: {
		bm25: number
		jarroWinker: number
	}
}
```

## Quotes and tables model for extraction
Base model idea - i got the base from perplexity and i did changes on top.
I did not even know where to start or what kind of things can go to this model, so this is my best guess
i am still not sure how should the extraction model look


## Quotes Extraction MODEL
```ts
import { z } from "zod";

export const NarrativeExtractionSchema = z.object({
  items: z.array(
    z.object({
      type: z.enum([
        "guidance",
        "risk",
        "management_commentary",
        "other",
      ]),

      // Short normalized description of what the filing says.
      statement: z.string(),

      // Exact supporting text copied from the HTML.
      quote: z.string().nullable(),
    }),
  ),
});

export type NarrativeExtractionResult =
  z.infer<typeof NarrativeExtractionSchema>;
```

## TABLE Extraction MODEL


```ts
import { z } from "zod";

export const TableExtractionSchema = z.object({
  title: z.string().nullable(),

  // Only populate when clearly stated or unambiguous from the table.
  currency: z.string().nullable(),

  // 1 = no multiplier
  // 1000 = "in thousands"
  // 1000000 = "in millions"
  scale: z.number().nullable(),

  columns: z.array(
    z.object({
      // Preserve the complete visible column heading.
      header: z.string(),
    }),
  ),

  rows: z.array(
    z.object({
      // Preserve the row label as shown in the table.
      label: z.string(),

      values: z.array(
        z.object({
          // Index into columns[].
          columnIndex: z.number().int().nonnegative(),

          // Exact cell value as represented in the table.
          raw: z.string(),

          // Parsed value when clearly numeric.
          // Keep it in the table's displayed scale.
          numeric: z.number().nullable(),
        }),
      ),
    }),
  ),
});

export type TableExtractionResult =
  z.infer<typeof TableExtractionSchema>;
```