import { describe, expect, it } from "bun:test";

import {
  QuoteExtractionItemsSchema,
  QuoteExtractionItemsSchemaWithCost,
  quoteExtractionPrompt,
  quoteExtractionSystemPrompt,
} from "./quotes";

describe("quote extraction agent", () => {
  it("keeps the prompt strict on verbatim quotes", () => {
    expect(quoteExtractionSystemPrompt).toContain("Do not paraphrase");
    expect(quoteExtractionSystemPrompt).toContain(
      "quote to verbatim source text",
    );
    expect(quoteExtractionSystemPrompt).toContain(
      "quote to null only when the exact span cannot be isolated",
    );
  });

  it("uses an array structured output schema", () => {
    expect(QuoteExtractionItemsSchema.safeParse([]).success).toBe(true);
    expect(QuoteExtractionItemsSchema.safeParse([{}]).success).toBe(false);
  });

  it("keeps the user prompt aligned to the tool priority", () => {
    expect(quoteExtractionPrompt).toContain("getExtractionData first");
    expect(quoteExtractionPrompt).toContain("GetAdjesonData only if");
    expect(quoteExtractionPrompt).not.toContain("cost");
  });

  it("keeps the system prompt on narrative prose and grounding rules", () => {
    expect(quoteExtractionSystemPrompt).toContain("narrative prose");
    expect(quoteExtractionSystemPrompt).toContain(
      'Use type "guidance" for forward guidance',
    );
    expect(quoteExtractionSystemPrompt).toContain("If nothing qualifies");
  });

  it("supports post-processed cost enrichment", () => {
    expect(
      QuoteExtractionItemsSchemaWithCost.safeParse([
        {
          type: "risk",
          statement: "Example",
          quote: null,
          grounding: undefined,
          cost: {
            inputTokens: 1,
            outputTokens: 2,
            totalTokens: 3,
            inputUsd: 0.1,
            outputUsd: 0.2,
            totalUsd: 0.3,
          },
        },
      ]).success,
    ).toBe(true);
  });
});
