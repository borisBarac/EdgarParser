import { describe, expect, mock, test } from "bun:test";
import { okAsync } from "neverthrow";

describe("llmExtract", () => {
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

        return okAsync(
          input.tools.extractionData.includes("chunk-0")
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

    const { llmExtract } = await import("./llm_extract");

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
        {
          id: 21,
          fileId: 1,
          orderInFile: 1,
          xpath: "/table[1]",
          text: "table-1",
          prevChunkId: 10,
          prevChunkFileId: 1,
          nextChunkId: null,
          nextChunkFileId: null,
          prevChunk: {
            id: 10,
            fileId: 1,
            orderInFile: 0,
            xpathStart: "/a",
            xpathEnd: "/a",
            text: "chunk-0",
          },
          nextChunk: null,
        },
      ],
    }).match(
      (value) => value,
      (error) => {
        throw new Error(`unexpected error: ${JSON.stringify(error)}`);
      },
    );

    expect(quoteCalls[0]).toContain("Current chunk extraction data");
    expect(quoteCalls[0]).toContain("chunk-0");
    expect(quoteCalls[1]).toContain("chunk-1");
    expect(quoteAdjesonData).toEqual([
      "Previous chunk context\n```text\n\n```",
      "Previous chunk context\n```text\nchunk-0\n```",
    ]);
    expect(quoteGroundingDocs).toEqual(["1", "1"]);
    expect(quoteGroundingChunkCounts).toEqual([2, 2]);
    expect(tableCalls[0]).toContain("Main table extraction data.");
    expect(tableCalls[0]).toContain("```html");
    expect(tableCalls[0]).toContain("table-0");
    expect(tableCalls[1]).toContain("table-1");
    expect(tableAdjesonData).toEqual([
      "Previous chunk context\n```text\n\n```",
      "Previous chunk context\n```text\nchunk-0\n```",
    ]);
    expect(tableSourceXpaths).toEqual(["/table[0]", "/table[1]"]);
    expect(result.quotes).toHaveLength(2);
    expect(result.tables).toHaveLength(2);
    expect(result.quotes[0]?.statement).toBe("quote-0");
    expect(result.quotes[1]?.statement).toBe("quote-1");
    expect(result.tables[0]?.title ?? "").toContain("table-0");
    expect(result.tables[1]?.title ?? "").toContain("table-1");
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
