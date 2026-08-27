// @ts-nocheck

import { describe, expect, test } from "bun:test";
import {
  runTableExtractionAgent,
  TableExtractionItemsSchema,
} from "../src/pipeline/llm_extraction/tables";

const liveLLM = Bun.argv.includes("--liveLLM");
const liveLLMEnabled = liveLLM || Bun.env.LIVE_LLM === "1";

const readRate = (key: string): number => {
  const value = Number(Bun.env[key]);
  if (!Number.isFinite(value)) {
    throw new Error(`missing or invalid env var: ${key}`);
  }

  return value;
};

describe("runTableExtractionAgent live", () => {
  test.skipIf(!liveLLMEnabled)(
    "returns structured table output",
    async () => {
      const miniRates = {
        inputUsdPer1M: readRate("MODEL_MINI_IN_COST_USD"),
        outputUsdPer1M: readRate("MODEL_MINI_OUT_COST_USD"),
      };

      const tableHtml = [
        "<table>",
        "<caption>Income Statement</caption>",
        "<thead><tr><th>Line Item</th><th>2024</th><th>2023</th></tr></thead>",
        "<tbody>",
        "<tr><td>Revenue</td><td>100</td><td>90</td></tr>",
        "<tr><td>Net income</td><td>25</td><td>20</td></tr>",
        "</tbody>",
        "</table>",
      ].join("");

      const result = await runTableExtractionAgent({
        tools: {
          extractionData: [
            "Primary table extraction data.",
            "Inspect the HTML table below and preserve its structure exactly.",
            "```html",
            tableHtml,
            "```",
          ].join("\n"),
          adjesonData: "",
        },
        source: {
          documentId: "doc-1",
          xpath: "/html/body/table[1]",
          html: tableHtml,
        },
      });

      console.log("runTableExtractionAgent live raw result", result);

      const value = await result.match(
        (output) => output,
        (error) => {
          throw new Error(JSON.stringify(error));
        },
      );

      console.log("runTableExtractionAgent live result", {
        type: typeof value,
        isArray: Array.isArray(value),
        value,
      });

      expect(Array.isArray(value)).toBe(true);
      expect(value.length).toBeGreaterThan(0);

      const table = value[0];
      expect(TableExtractionItemsSchema.safeParse(table).success).toBe(true);
      expect(table.title).not.toBeNull();
      expect(table.columns.length).toBeGreaterThan(0);
      expect(table.rows.length).toBeGreaterThan(0);
      expect(table.rows[0]?.values.length).toBeGreaterThan(0);
      if (table.grounding !== undefined) {
        expect(table.grounding.documentId).toBe("doc-1");
      }

      const expectedInputUsd =
        (table.cost.inputTokens / 1_000_000) * miniRates.inputUsdPer1M;
      const expectedOutputUsd =
        (table.cost.outputTokens / 1_000_000) * miniRates.outputUsdPer1M;
      const expectedTotalUsd = expectedInputUsd + expectedOutputUsd;

      expect(table.cost.inputTokens).toBeGreaterThan(0);
      expect(table.cost.outputTokens).toBeGreaterThan(0);
      expect(table.cost.totalTokens).toBeGreaterThan(0);
      expect(table.cost.inputUsd).toBeCloseTo(expectedInputUsd, 12);
      expect(table.cost.outputUsd).toBeCloseTo(expectedOutputUsd, 12);
      expect(table.cost.totalUsd).toBeCloseTo(expectedTotalUsd, 12);
    },
    {
      timeout: 30_000,
    },
  );
});
