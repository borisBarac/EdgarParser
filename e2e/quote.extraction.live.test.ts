import { describe, expect, test } from "bun:test";

import { runQuoteExtractionAgent } from "../src/pipeline/llm_extraction/quotes";
import { QuoteExtractionItemsSchemaWithCostAndGrounding } from "../src/pipeline/model";
import { unwrapAndLogResult } from "../src/utility/debug";

const liveLLM = Bun.argv.includes("--liveLLM");
const liveLLMEnabled = liveLLM || Bun.env.LIVE_LLM === "1";

const readRate = (key: string): number => {
  const value = Number(Bun.env[key]);
  if (!Number.isFinite(value)) {
    throw new Error(`missing or invalid env var: ${key}`);
  }

  return value;
};

const readQuoteHtml = async (): Promise<string> =>
  Bun.file(new URL("./quote.html", import.meta.url)).text();

const assertQuoteResult = (
  value: unknown,
  miniRates: Readonly<{ inputUsdPer1M: number; outputUsdPer1M: number }>,
  expectedDocumentId: string,
) => {
  expect(Array.isArray(value)).toBe(true);
  expect(value.length).toBeGreaterThan(0);
  expect(
    QuoteExtractionItemsSchemaWithCostAndGrounding.safeParse(value).success,
  ).toBe(true);

  const quote = value[0];
  expect(quote.statement).toBeTruthy();
  expect(quote.type).toMatch(/^(guidance|risk|management_commentary|other)$/);

  if (quote.grounding !== undefined) {
    expect(quote.grounding.documentId).toBe(expectedDocumentId);
  }

  const expectedInputUsd =
    (quote.cost.inputTokens / 1_000_000) * miniRates.inputUsdPer1M;
  const expectedOutputUsd =
    (quote.cost.outputTokens / 1_000_000) * miniRates.outputUsdPer1M;
  const expectedTotalUsd = expectedInputUsd + expectedOutputUsd;

  expect(quote.cost.inputTokens).toBeGreaterThan(0);
  expect(quote.cost.outputTokens).toBeGreaterThan(0);
  expect(quote.cost.totalTokens).toBeGreaterThan(0);
  expect(quote.cost.inputUsd).toBeCloseTo(expectedInputUsd, 12);
  expect(quote.cost.outputUsd).toBeCloseTo(expectedOutputUsd, 12);
  expect(quote.cost.totalUsd).toBeCloseTo(expectedTotalUsd, 12);
};

const runLiveQuoteTest = async (
  quoteText: string,
  label: string,
  documentId = "doc-1",
) => {
  const result = await runQuoteExtractionAgent({
    tools: {
      extractionData: [
        "Primary narrative extraction data.",
        "Inspect the prose below and extract qualifying quotes exactly.",
        "```text",
        quoteText,
        "```",
      ].join("\n"),
      adjesonData: "",
    },
    documentId,
    chunks: [
      {
        id: "chunk-1",
        orderInFile: 1,
        text: quoteText,
        xpathStart: "/html/body/p[1]",
        xpathEnd: "/html/body/p[1]",
      },
    ],
  });

  const value = await unwrapAndLogResult(result, label);

  const miniRates = {
    inputUsdPer1M: readRate("MODEL_MINI_IN_COST_USD"),
    outputUsdPer1M: readRate("MODEL_MINI_OUT_COST_USD"),
  };

  assertQuoteResult(value, miniRates, documentId);
};

describe("runQuoteExtractionAgent live", () => {
  test.skipIf(!liveLLMEnabled)(
    "returns structured quote output",
    async () => {
      await runLiveQuoteTest(
        [
          "Management expects revenue growth to accelerate in 2025.",
          "We continue to see elevated litigation risk in the segment.",
          "Our cash position remains strong and supports planned investments.",
        ].join(" "),
        "returns structured quote output",
      );
    },
    {
      timeout: 30_000,
    },
  );

  test.skipIf(!liveLLMEnabled)(
    "returns structured quote output for the real fixture",
    async () => {
      const quoteHtml = await readQuoteHtml();

      await runLiveQuoteTest(
        quoteHtml,
        "returns structured quote output for the real fixture",
      );
    },
    {
      timeout: 30_000,
    },
  );
});
