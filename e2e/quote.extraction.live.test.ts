import { describe, expect, test } from "bun:test";

import { runQuoteExtractionAgent } from "../src/pipeline/llm_extraction/quotes";
import { QuoteExtractionItemsSchemaWithCostAndGrounding } from "../src/pipeline/model";

const liveLLM = Bun.argv.includes("--liveLLM");
const liveLLMEnabled = liveLLM || Bun.env.LIVE_LLM === "1";

const readRate = (key: string): number => {
  const value = Number(Bun.env[key]);
  if (!Number.isFinite(value)) {
    throw new Error(`missing or invalid env var: ${key}`);
  }

  return value;
};

describe("runQuoteExtractionAgent live", () => {
  test.skipIf(!liveLLMEnabled)(
    "returns structured quote output",
    async () => {
      const miniRates = {
        inputUsdPer1M: readRate("MODEL_MINI_IN_COST_USD"),
        outputUsdPer1M: readRate("MODEL_MINI_OUT_COST_USD"),
      };

      const prose = [
        "Management expects revenue growth to accelerate in 2025.",
        "We continue to see elevated litigation risk in the segment.",
        "Our cash position remains strong and supports planned investments.",
      ].join(" ");

      const result = await runQuoteExtractionAgent({
        tools: {
          extractionData: [
            "Primary narrative extraction data.",
            "Inspect the prose below and extract qualifying quotes exactly.",
            "```text",
            prose,
            "```",
          ].join("\n"),
          adjesonData: "",
        },
        documentId: "doc-1",
        chunks: [
          {
            id: "chunk-1",
            orderInFile: 1,
            text: prose,
            xpathStart: "/html/body/p[1]",
            xpathEnd: "/html/body/p[1]",
          },
        ],
      });

      console.log("runQuoteExtractionAgent live raw result", result);

      const value = await result.match(
        (output) => output,
        (error) => {
          throw new Error(JSON.stringify(error));
        },
      );

      console.log("runQuoteExtractionAgent live result", {
        type: typeof value,
        isArray: Array.isArray(value),
        value,
      });

      expect(Array.isArray(value)).toBe(true);
      expect(value.length).toBeGreaterThan(0);
      expect(
        QuoteExtractionItemsSchemaWithCostAndGrounding.safeParse(value).success,
      ).toBe(true);

      const quote = value[0];
      expect(quote.statement).toBeTruthy();
      expect(quote.type).toMatch(
        /^(guidance|risk|management_commentary|other)$/,
      );
      if (quote.grounding !== undefined) {
        expect(quote.grounding.documentId).toBe("doc-1");
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
    },
    {
      timeout: 30_000,
    },
  );
});
