import { describe, expect, it } from "bun:test";

import {
  TableExtractionItemsSchema,
  TableExtractionItemsSchemaWithCostAndGrounding,
  tableExtractionPrompt,
  tableExtractionSystemPrompt,
} from "./tables";

describe("table extraction agent", () => {
  it("keeps the prompt focused on EDGAR financial tables", () => {
    expect(tableExtractionSystemPrompt).toContain(
      "financial tables from EDGAR filings",
    );
    expect(tableExtractionSystemPrompt).toContain("Do not paraphrase");
    expect(tableExtractionSystemPrompt).toContain(
      "Set numeric only when the value is unambiguous",
    );
  });

  it("uses an array structured output schema", () => {
    expect(TableExtractionItemsSchema.safeParse([]).success).toBe(true);
    expect(TableExtractionItemsSchema.safeParse([{}]).success).toBe(false);
  });

  it("keeps the user prompt aligned to the tool priority", () => {
    expect(tableExtractionPrompt).toContain("getExtractionData first");
    expect(tableExtractionPrompt).toContain("GetAdjesonData only if");
    expect(tableExtractionPrompt).not.toContain("cost");
  });

  it("keeps the system prompt on financial tables and preservation rules", () => {
    expect(tableExtractionSystemPrompt).toContain(
      "financial tables from EDGAR filings",
    );
    expect(tableExtractionSystemPrompt).toContain(
      "Preserve the table structure",
    );
    expect(tableExtractionSystemPrompt).toContain(
      "Keep title, currency, and scale",
    );
  });

  it("supports post-processed cost enrichment", () => {
    expect(
      TableExtractionItemsSchemaWithCostAndGrounding.safeParse([
        {
          title: "Example",
          currency: null,
          scale: null,
          columns: [],
          rows: [],
          cost: {
            inputTokens: 1,
            outputTokens: 2,
            totalTokens: 3,
            inputUsd: 0.1,
            outputUsd: 0.2,
            totalUsd: 0.3,
          },
          grounding: {
            documentId: "doc-1",
            chunks: [],
            score: {
              bm25: 0,
              jaccardSimilarity: 0,
            },
          },
        },
      ]).success,
    ).toBe(true);
  });
});
