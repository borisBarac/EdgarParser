import { describe, expect, test } from "bun:test";
import { z } from "zod";

import { runStructuredAgent } from "../src/agent";

const liveLLM = Bun.argv.includes("--liveLLM");
const liveLLMEnabled = liveLLM || Bun.env.LIVE_LLM === "1";

const readRate = (key: string): number => {
  const value = Number(Bun.env[key]);
  if (!Number.isFinite(value)) {
    throw new Error(`missing or invalid env var: ${key}`);
  }

  return value;
};

describe("runStructuredAgent live", () => {
  test.skipIf(!liveLLMEnabled)(
    "respects schema and cost math",
    async () => {
      const miniRates = {
        inputUsdPer1M: readRate("MODEL_MINI_IN_COST_USD"),
        outputUsdPer1M: readRate("MODEL_MINI_OUT_COST_USD"),
      };

      const schema = z.object({
        answer: z.literal("ok"),
        items: z.array(z.string()).length(2),
      });

      const result = await runStructuredAgent({
        systemPrompt:
          "You produce only structured output that exactly matches the provided schema. No markdown, no extra keys, no commentary.",
        prompt:
          'Return an object with answer set to "ok" and items set to ["a", "b"].',
        schema,
      });

      const value = await result.match(
        (output) => output,
        (error) => {
          throw new Error(JSON.stringify(error));
        },
      );

      expect(value.output).toEqual({
        answer: "ok",
        items: ["a", "b"],
      });

      const expectedInputUsd =
        (value.cost.inputTokens / 1_000_000) * miniRates.inputUsdPer1M;
      const expectedOutputUsd =
        (value.cost.outputTokens / 1_000_000) * miniRates.outputUsdPer1M;
      const expectedTotalUsd = expectedInputUsd + expectedOutputUsd;

      expect(value.cost.inputTokens).toBeGreaterThan(0);
      expect(value.cost.outputTokens).toBeGreaterThan(0);
      expect(value.cost.totalTokens).toBeGreaterThan(0);
      expect(value.cost.inputUsd).toBeCloseTo(expectedInputUsd, 12);
      expect(value.cost.outputUsd).toBeCloseTo(expectedOutputUsd, 12);
      expect(value.cost.totalUsd).toBeCloseTo(expectedTotalUsd, 12);
    },
    {
      timeout: 30_000,
    },
  );
});
