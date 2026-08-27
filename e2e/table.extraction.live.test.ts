// @ts-nocheck
import { describe, expect, test } from "bun:test";

import {
  runTableExtractionAgent,
  TableExtractionItemsSchemaWithCostAndGrounding,
} from "../src/pipeline/llm_extraction/tables";
import { unwrapAndLogResult } from "../src/utility/debug";

const liveLLM = Bun.argv.includes("--liveLLM");
const liveLLMEnabled = liveLLM || Bun.env.LIVE_LLM === "1";

const readRate = (key: string): number => {
  const value = Number(Bun.env[key]);
  expect(Number.isFinite(value)).toBe(true);

  return value;
};

const readTableHtml = async (path: URL): Promise<string> =>
  Bun.file(path).text();

const assertTableResult = (
  value: unknown,
  miniRates: Readonly<{ inputUsdPer1M: number; outputUsdPer1M: number }>,
  expectedDocumentId: string,
  requireNonEmptyCell: boolean,
) => {
  const tables = TableExtractionItemsSchemaWithCostAndGrounding.parse(value);
  expect(tables.length).toBeGreaterThan(0);

  const table = tables[0];
  expect(table.columns.length).toBeGreaterThan(0);
  expect(table.rows.length).toBeGreaterThan(0);

  if (requireNonEmptyCell) {
    expect(
      table.rows.some(
        (row) =>
          row.label.trim().length > 0 ||
          row.values.some((cell) => cell.raw.trim().length > 0),
      ),
    ).toBe(true);
  } else {
    expect(table.rows[0]?.values.length).toBeGreaterThan(0);
    expect(table.title).not.toBeNull();
  }

  if (table.grounding !== undefined) {
    expect(table.grounding.documentId).toBe(expectedDocumentId);
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

  return tables;
};

const runLiveTableTest = async (
  tableHtml: string,
  expectedDocumentId: string,
  requireNonEmptyCell: boolean,
  label: string,
) => {
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
      documentId: expectedDocumentId,
      xpath: "/html/body/table[1]",
      html: tableHtml,
    },
  });

  const value = await unwrapAndLogResult(result, label);

  const miniRates = {
    inputUsdPer1M: readRate("MODEL_MINI_IN_COST_USD"),
    outputUsdPer1M: readRate("MODEL_MINI_OUT_COST_USD"),
  };

  assertTableResult(value, miniRates, expectedDocumentId, requireNonEmptyCell);
};

describe("runTableExtractionAgent live", () => {
  test.skipIf(!liveLLMEnabled)(
    "returns structured table output",
    async () => {
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

      await runLiveTableTest(
        tableHtml,
        "doc-1",
        false,
        "returns structured table output",
      );
    },
    {
      timeout: 30_000,
    },
  );

  test.skipIf(!liveLLMEnabled)(
    "returns structured table output for the real fixture",
    async () => {
      const tableHtml = await readTableHtml(
        new URL("./table.html", import.meta.url),
      );

      await runLiveTableTest(
        tableHtml,
        "doc-1",
        true,
        "returns structured table output for the real fixture",
      );
    },
    {
      timeout: 30_000,
    },
  );
});
