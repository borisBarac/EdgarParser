import { describe, expect, mock, test } from "bun:test";
import { okAsync } from "neverthrow";

mock.module("../../agent", () => ({
  runStructuredAgent: () =>
    okAsync({
      output: [
        {
          title: "Income Statement",
          currency: null,
          scale: null,
          columns: [],
          rows: [
            {
              label: "Revenue",
              values: [{ columnIndex: 0, raw: "100", numeric: 100 }],
            },
          ],
          grounding: undefined,
        },
      ],
      cost: {
        inputTokens: 1,
        outputTokens: 2,
        totalTokens: 3,
        inputUsd: 0.01,
        outputUsd: 0.02,
        totalUsd: 0.03,
      },
    }),
}));

describe("table extraction grounding", () => {
  test("grounds extracted tables when source is provided", async () => {
    const { runTableExtractionAgent } = await import("./tables");

    const result = await runTableExtractionAgent({
      tools: {
        companyContextData: "",
        extractionData: "<table/>",
        adjesonData: "",
      },
      source: {
        documentId: "doc-1",
        xpath: "/html/body/table[1]",
        html: "<table><tbody><tr><td>Revenue</td><td>100</td></tr></tbody></table>",
      },
    }).match(
      (value) => value,
      (error) => {
        throw new Error(`unexpected error: ${JSON.stringify(error)}`);
      },
    );

    expect(result[0]?.grounding?.documentId).toBe("doc-1");
    expect(result[0]?.grounding?.chunks[0]?.id).toBe("/html/body/table[1]");
  });

  test("leaves grounding undefined when source is missing", async () => {
    const { runTableExtractionAgent } = await import("./tables");

    const result = await runTableExtractionAgent({
      tools: {
        companyContextData: "",
        extractionData: "<table/>",
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
