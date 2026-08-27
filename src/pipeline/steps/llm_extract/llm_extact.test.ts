// @ts-nocheck
import { describe, expect, mock, test } from "bun:test";
import { okAsync } from "neverthrow";

const baseCost = {
  inputTokens: 1,
  outputTokens: 1,
  totalTokens: 2,
  inputUsd: 0.01,
  outputUsd: 0.01,
  totalUsd: 0.02,
} as const;

const unwrapResult = async <T, E>(result: {
  match: (ok: (value: T) => T, err: (error: E) => T) => Promise<T>;
}) =>
  result.match(
    (value) => value,
    (error) => {
      throw new Error(`unexpected error: ${JSON.stringify(error)}`);
    },
  );

const withEnv = async <T>(
  key: "MINI_EXTRACTION",
  value: string | undefined,
  run: () => Promise<T>,
) => {
  const previous = Bun.env[key];

  if (value === undefined) {
    delete Bun.env[key];
  } else {
    Bun.env[key] = value;
  }

  try {
    return await run();
  } finally {
    if (previous === undefined) {
      delete Bun.env[key];
    } else {
      Bun.env[key] = previous;
    }
  }
};

const makeChunk = (index: number) => ({
  id: 10 + index,
  fileId: 1,
  orderInFile: index,
  xpathStart: `/chunk-${index}`,
  xpathEnd: `/chunk-${index}`,
  text: `<p>${`chunk-${index} `.repeat(40)}</p>`,
});

const makeTable = (index: number, includePreviousChunk = false) => ({
  id: 20 + index,
  fileId: 1,
  orderInFile: index,
  xpath: `/table[${index}]`,
  text: `<table>${`table-${index} `.repeat(40)}</table>`,
  prevChunkId: includePreviousChunk ? 10 : null,
  prevChunkFileId: includePreviousChunk ? 1 : null,
  nextChunkId: null,
  nextChunkFileId: null,
  prevChunk: includePreviousChunk
    ? {
        id: 10,
        fileId: 1,
        orderInFile: 0,
        xpathStart: "/a",
        xpathEnd: "/a",
        text: "chunk-0",
      }
    : null,
  nextChunk: null,
});

const makeQuote = (index: number, type: "guidance" | "risk") => ({
  type,
  statement: `quote-${index}`,
  quote: `quote-${index}`,
  grounding: undefined,
  cost: baseCost,
});

const makeTableResult = (index: number) => ({
  title: `table-${index}`,
  currency: null,
  scale: null,
  columns: [],
  rows: [],
  grounding: undefined,
  cost: baseCost,
});

describe("llmExtract", () => {
  test("skips quote and table extraction for short visible content", async () => {
    const quoteCalls: string[] = [];
    const tableCalls: string[] = [];

    mock.module("../../llm_extraction/quotes", () => ({
      runQuoteExtractionAgent: (input: {
        readonly tools: {
          readonly extractionData: string;
          readonly adjesonData: string;
        };
      }) => {
        quoteCalls.push(input.tools.extractionData);
        return okAsync([]);
      },
    }));

    mock.module("../../llm_extraction/tables", () => ({
      runTableExtractionAgent: (input: {
        readonly tools: { readonly extractionData: string };
      }) => {
        tableCalls.push(input.tools.extractionData);
        return okAsync([makeTableResult(0)]);
      },
    }));

    const { llmExtract } = await import("./llm_extract");

    const result = await unwrapResult(
      llmExtract({
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
            text: "<p>short chunk</p>",
          },
        ],
        tables: [
          {
            id: 20,
            fileId: 1,
            orderInFile: 0,
            xpath: "/table[0]",
            text: "table-0",
            prevChunkId: null,
            prevChunkFileId: null,
            nextChunkId: null,
            nextChunkFileId: null,
            prevChunk: null,
            nextChunk: null,
          },
        ],
      }),
    );

    expect(quoteCalls).toHaveLength(0);
    expect(result.quotes).toHaveLength(0);
    expect(tableCalls).toHaveLength(0);
    expect(result.tables).toHaveLength(0);
  });

  test("runs quote and table extraction sequentially per chunk and returns a pipeline model", async () => {
    const quoteCalls: string[] = [];
    const quoteAdjesonData: string[] = [];
    const quoteGroundingDocs: Array<string | undefined> = [];
    const quoteGroundingChunkCounts: number[] = [];
    const tableCalls: string[] = [];
    const tableAdjesonData: string[] = [];
    const tableSourceXpaths: Array<string | undefined> = [];

    mock.module("../../llm_extraction/quotes", () => ({
      runQuoteExtractionAgent: (input: {
        readonly tools: {
          readonly extractionData: string;
          readonly adjesonData: string;
        };
        readonly documentId?: string;
        readonly chunks?: readonly { readonly id: string }[];
      }) => {
        quoteCalls.push(input.tools.extractionData);
        quoteAdjesonData.push(input.tools.adjesonData);
        quoteGroundingDocs.push(input.documentId);
        quoteGroundingChunkCounts.push(input.chunks?.length ?? 0);
        const index = quoteCalls.length - 1;

        return okAsync([
          makeQuote(index, index % 2 === 0 ? "guidance" : "risk"),
        ]);
      },
    }));

    mock.module("../../llm_extraction/tables", () => ({
      runTableExtractionAgent: (input: {
        readonly tools: {
          readonly extractionData: string;
          readonly adjesonData: string;
        };
        readonly source?: {
          readonly documentId: string;
          readonly xpath: string;
          readonly html: string;
        };
      }) => {
        tableCalls.push(input.tools.extractionData);
        tableAdjesonData.push(input.tools.adjesonData);
        tableSourceXpaths.push(input.source?.xpath);

        return okAsync([
          {
            ...makeTableResult(tableCalls.length - 1),
            title: input.tools.extractionData,
          },
        ]);
      },
    }));

    const { llmExtract } = await import("./llm_extract");

    const result = await unwrapResult(
      llmExtract({
        file: {
          id: 1,
          orgFilePath: "/tmp/input.html",
          cleanFilePath: "/tmp/clean.html",
        },
        chunks: [makeChunk(0), makeChunk(1), makeChunk(2)],
        tables: [makeTable(0), makeTable(1, true)],
      }),
    );

    expect(quoteCalls[0]).toContain("Current chunk extraction data");
    expect(quoteCalls[0]).toContain("chunk-0");
    expect(quoteCalls[1]).toContain("chunk-1");
    expect(quoteAdjesonData).toHaveLength(3);
    expect(quoteAdjesonData[0]).toContain("Previous chunk context");
    expect(quoteAdjesonData[1]).toContain("Previous chunk context");
    expect(quoteAdjesonData[1]).toContain("chunk-0");
    expect(quoteGroundingDocs).toEqual(["1", "1", "1"]);
    expect(quoteGroundingChunkCounts).toEqual([1, 2, 2]);
    expect(tableCalls[0]).toContain("Main table extraction data.");
    expect(tableCalls[0]).toContain("```html");
    expect(tableCalls[0]).toContain("table-0");
    expect(tableCalls[1]).toContain("table-1");
    expect(tableAdjesonData).toEqual([
      "Previous chunk context\n```text\n\n```",
      "Previous chunk context\n```text\nchunk-0\n```",
    ]);
    expect(tableSourceXpaths).toEqual(["/table[0]", "/table[1]"]);
    expect(result.quotes).toHaveLength(3);
    expect(result.tables).toHaveLength(2);
    expect(result.quotes[0]?.statement).toBe("quote-0");
    expect(result.quotes[1]?.statement).toBe("quote-1");
    expect(result.quotes[2]?.statement).toBe("quote-2");
    expect(result.tables[0]?.title ?? "").toContain("table-0");
    expect(result.tables[1]?.title ?? "").toContain("table-1");
  });

  test("caps quote and table extraction when MINI_EXTRACTION=1", async () => {
    await withEnv("MINI_EXTRACTION", "1", async () => {
      const quoteCalls: string[] = [];
      const tableCalls: string[] = [];

      mock.module("../../llm_extraction/quotes", () => ({
        runQuoteExtractionAgent: (input: {
          readonly tools: { readonly extractionData: string };
        }) => {
          quoteCalls.push(input.tools.extractionData);
          return okAsync([makeQuote(quoteCalls.length - 1, "guidance")]);
        },
      }));

      mock.module("../../llm_extraction/tables", () => ({
        runTableExtractionAgent: (input: {
          readonly tools: { readonly extractionData: string };
        }) => {
          tableCalls.push(input.tools.extractionData);
          return okAsync([makeTableResult(tableCalls.length - 1)]);
        },
      }));

      const { llmExtract } = await import("./llm_extract");

      const result = await unwrapResult(
        llmExtract({
          file: {
            id: 1,
            orgFilePath: "/tmp/input.html",
            cleanFilePath: "/tmp/clean.html",
          },
          chunks: Array.from({ length: 31 }, (_, index) => makeChunk(index)),
          tables: Array.from({ length: 11 }, (_, index) => makeTable(index)),
        }),
      );

      expect(quoteCalls).toHaveLength(30);
      expect(tableCalls).toHaveLength(10);
      expect(quoteCalls[29]).toContain("chunk-29");
      expect(tableCalls[9]).toContain("table-9");
      expect(result.quotes).toHaveLength(30);
      expect(result.tables).toHaveLength(10);
    });
  });

  test("creates table agent input with html extraction data and adjacent chunk text", async () => {
    const { createTableAgentInput } = await import("./llm_extract");

    const table = {
      id: 20,
      fileId: 1,
      orderInFile: 1,
      xpath: "/table[1]",
      text: "<table><tr><td>Revenue</td></tr></table>",
      prevChunkId: 10,
      prevChunkFileId: 1,
      nextChunkId: null,
      nextChunkFileId: null,
      prevChunk: {
        id: 10,
        fileId: 1,
        orderInFile: 0,
        xpathStart: "/p[1]",
        xpathEnd: "/p[1]",
        text: "chunk-above-table",
      },
      nextChunk: null,
    };

    const result = createTableAgentInput(1, table);

    expect(result.tools.extractionData).toContain("```html");
    expect(result.tools.extractionData).toContain(table.text);
    expect(result.tools.adjesonData).toBe(
      "Previous chunk context\n```text\nchunk-above-table\n```",
    );
  });
});
