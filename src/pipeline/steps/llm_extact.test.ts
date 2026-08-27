import { describe, expect, mock, test } from "bun:test";
import { okAsync } from "neverthrow";

describe("llmExtract", () => {
  test("runs quote and table extraction sequentially per chunk and returns a pipeline model", async () => {
    const quoteCalls: string[] = [];
    const tableCalls: string[] = [];

    mock.module("../llm_extraction/quotes", () => ({
      runQuoteExtractionAgent: (input: {
        readonly tools: { readonly extractionData: string };
      }) => {
        quoteCalls.push(input.tools.extractionData);

        return okAsync(
          input.tools.extractionData === "chunk-0"
            ? [
                {
                  type: "guidance",
                  statement: "quote-0",
                  quote: "quote-0",
                  grounding: undefined,
                  cost: {
                    inputTokens: 1,
                    outputTokens: 2,
                    totalTokens: 3,
                    inputUsd: 0.01,
                    outputUsd: 0.02,
                    totalUsd: 0.03,
                  },
                },
              ]
            : [
                {
                  type: "risk",
                  statement: "quote-1",
                  quote: null,
                  grounding: undefined,
                  cost: {
                    inputTokens: 4,
                    outputTokens: 5,
                    totalTokens: 9,
                    inputUsd: 0.04,
                    outputUsd: 0.05,
                    totalUsd: 0.09,
                  },
                },
              ],
        );
      },
    }));

    mock.module("../llm_extraction/tables", () => ({
      runTableExtractionAgent: (input: {
        readonly tools: { readonly extractionData: string };
      }) => {
        tableCalls.push(input.tools.extractionData);

        return okAsync([
          {
            title: input.tools.extractionData,
            currency: null,
            scale: null,
            columns: [],
            rows: [],
            grounding: undefined,
            cost: {
              inputTokens: 1,
              outputTokens: 1,
              totalTokens: 2,
              inputUsd: 0.01,
              outputUsd: 0.01,
              totalUsd: 0.02,
            },
          },
        ]);
      },
    }));

    const { llmExtract } = await import("./llm_extact");

    const result = await llmExtract({
      file: {
        id: 1,
        orgFilePath: "/tmp/input.html",
        cleanFilePath: "/tmp/clean.html",
      },
      chunks: [
        {
          id: 10,
          fileId: 1,
          orderInFile: 0,
          xpathStart: "/a",
          xpathEnd: "/a",
          text: "chunk-0",
        },
        {
          id: 11,
          fileId: 1,
          orderInFile: 1,
          xpathStart: "/b",
          xpathEnd: "/b",
          text: "chunk-1",
        },
      ],
      tables: [],
    }).match(
      (value) => value,
      (error) => {
        throw new Error(`unexpected error: ${JSON.stringify(error)}`);
      },
    );

    expect(quoteCalls).toEqual(["chunk-0", "chunk-1"]);
    expect(tableCalls).toEqual(["chunk-0", "chunk-1"]);
    expect(result.quotes).toHaveLength(2);
    expect(result.tables).toHaveLength(2);
    expect(result.quotes[0]?.statement).toBe("quote-0");
    expect(result.quotes[1]?.statement).toBe("quote-1");
    expect(result.tables[0]?.title).toBe("chunk-0");
    expect(result.tables[1]?.title).toBe("chunk-1");
  });
});
