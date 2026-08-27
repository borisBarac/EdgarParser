import { describe, expect, mock, test } from "bun:test";
import { err, ok, okAsync } from "neverthrow";

describe("runQuoteExtractionAgent grounding", () => {
  test("grounds items when grounding input is provided", async () => {
    mock.module("../../agent", () => ({
      runStructuredAgent: () =>
        okAsync({
          output: {
            items: [
              {
                type: "risk",
                statement: "statement",
                quote: "quote",
                grounding: undefined,
              },
            ],
          },
          cost: {
            inputTokens: 1,
            outputTokens: 2,
            totalTokens: 3,
            inputUsd: 0.1,
            outputUsd: 0.2,
            totalUsd: 0.3,
          },
        }),
    }));

    mock.module("../grounding/quote_grounding", () => ({
      groundQuoteExtractionItem: (input: { readonly statement: string }) =>
        ok({
          documentId: "doc-1",
          chunks: [],
          score: { bm25: 1, jaccardSimilarity: 1 },
          statement: input.statement,
        }),
    }));

    const { runQuoteExtractionAgent } = await import("./quotes");

    const result = await runQuoteExtractionAgent({
      tools: {
        extractionData: "chunk",
        adjesonData: "",
      },
      documentId: "doc-1",
      chunks: [
        {
          id: "c1",
          orderInFile: 1,
          text: "text",
          xpathStart: "/html/body/p[1]",
          xpathEnd: "/html/body/p[1]",
        },
      ],
    }).match(
      (value) => value,
      (error) => {
        throw new Error(`unexpected error: ${JSON.stringify(error)}`);
      },
    );

    expect(result[0]?.grounding?.documentId).toBe("doc-1");
    expect(result[0]?.cost.totalUsd).toBe(0.3);
  });

  test("leaves grounding undefined when grounding input is missing", async () => {
    mock.module("../../agent", () => ({
      runStructuredAgent: () =>
        okAsync({
          output: {
            items: [
              {
                type: "risk",
                statement: "statement",
                quote: "quote",
                grounding: undefined,
              },
            ],
          },
          cost: {
            inputTokens: 1,
            outputTokens: 2,
            totalTokens: 3,
            inputUsd: 0.1,
            outputUsd: 0.2,
            totalUsd: 0.3,
          },
        }),
    }));

    mock.module("../grounding/quote_grounding", () => ({
      groundQuoteExtractionItem: () => err({ type: "empty_query" as const }),
    }));

    const { runQuoteExtractionAgent } = await import("./quotes");

    const result = await runQuoteExtractionAgent({
      tools: {
        extractionData: "chunk",
        adjesonData: "",
      },
    }).match(
      (value) => value,
      (error) => {
        throw new Error(`unexpected error: ${JSON.stringify(error)}`);
      },
    );

    expect(result[0]?.grounding).toBeUndefined();
  });
});
