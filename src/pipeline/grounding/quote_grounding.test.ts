import { describe, expect, test } from "bun:test";
import { messyQuotes } from "./cases";
import { groundQuoteExtractionItem } from "./quote_grounding";

describe("groundQuoteExtractionItem", () => {
  test("grounds using both quote and statement across all chunks", () => {
    const result = groundQuoteExtractionItem({
      documentId: "doc-1",
      statement: "Revenue increased due to demand",
      quote: "demand",
      chunks: [
        {
          id: "c2",
          orderInFile: 2,
          text: "The demand improved later in the year.",
          xpathStart: "/html/body/p[2]",
          xpathEnd: "/html/body/p[2]",
        },
        {
          id: "c1",
          orderInFile: 1,
          text: "Revenue increased because demand rose strongly.",
          xpathStart: "/html/body/p[1]",
          xpathEnd: "/html/body/p[1]",
        },
      ],
    });

    const grounding = result.match(
      (value) => value,
      (error) => {
        throw new Error(`unexpected error: ${JSON.stringify(error)}`);
      },
    );

    expect(grounding.documentId).toBe("doc-1");
    expect(grounding.chunks.map((chunk) => chunk.id)).toEqual(["c1", "c2"]);
    expect(grounding.score.bm25).toBeGreaterThan(1);
    expect(grounding.score.jaccardSimilarity).toBeGreaterThan(0);
  });

  test("ignores html tags in chunk text", () => {
    const result = groundQuoteExtractionItem({
      documentId: "doc-1",
      statement: "Revenue increased",
      quote: "Revenue",
      chunks: [
        {
          id: "c1",
          orderInFile: 1,
          text: "<div>Revenue <span>increased</span></div>",
          xpathStart: "/html/body/p[1]",
          xpathEnd: "/html/body/p[1]",
        },
      ],
    });

    const grounding = result.match(
      (value) => value,
      (error) => {
        throw new Error(`unexpected error: ${JSON.stringify(error)}`);
      },
    );

    expect(grounding.score.bm25).toBeGreaterThan(1);
    expect(grounding.score.jaccardSimilarity).toBeGreaterThan(0);
  });

  test("falls back to statement when quote is null", () => {
    const result = groundQuoteExtractionItem({
      documentId: "doc-2",
      statement: "Operating income expanded",
      quote: null,
      chunks: [
        {
          id: "c1",
          orderInFile: 1,
          text: "Operating income expanded during the quarter.",
          xpathStart: null,
          xpathEnd: null,
        },
      ],
    });

    const grounding = result.match(
      (value) => value,
      (error) => {
        throw new Error(`unexpected error: ${JSON.stringify(error)}`);
      },
    );

    expect(grounding.chunks).toEqual([
      {
        id: "c1",
        chunkXpathStart: null,
        chunkXpathEnd: null,
      },
    ]);
    expect(grounding.score.bm25).toBeGreaterThan(1);
  });

  test("grounds blank query text with zero score", () => {
    const result = groundQuoteExtractionItem({
      documentId: "doc-3",
      statement: "   ",
      quote: "  ",
      chunks: [
        {
          id: "c1",
          orderInFile: 1,
          text: "text",
          xpathStart: null,
          xpathEnd: null,
        },
      ],
    });

    const grounding = result._unsafeUnwrap();

    expect(grounding.documentId).toBe("doc-3");
    expect(grounding.score.bm25).toBe(0);
    expect(grounding.score.jaccardSimilarity).toBe(0);
  });

  test("grounds corrupted extraction data with zero score", () => {
    const result = groundQuoteExtractionItem({
      documentId: "doc-3b",
      statement: "   ",
      quote: "",
      chunks: [
        {
          id: "c1",
          orderInFile: 1,
          text: "Revenue increased because demand rose strongly.",
          xpathStart: "/html/body/p[1]",
          xpathEnd: "/html/body/p[1]",
        },
      ],
    });

    const grounding = result._unsafeUnwrap();

    expect(grounding.documentId).toBe("doc-3b");
    expect(grounding.chunks).toEqual([
      {
        id: "c1",
        chunkXpathStart: "/html/body/p[1]",
        chunkXpathEnd: "/html/body/p[1]",
      },
    ]);
    expect(grounding.score.bm25).toBe(0);
    expect(grounding.score.jaccardSimilarity).toBe(0);
  });

  test("grounds empty chunks with zero score", () => {
    const result = groundQuoteExtractionItem({
      documentId: "doc-4",
      statement: "anything",
      quote: null,
      chunks: [],
    });

    const grounding = result._unsafeUnwrap();

    expect(grounding.documentId).toBe("doc-4");
    expect(grounding.chunks).toEqual([]);
    expect(grounding.score.bm25).toBe(0);
    expect(grounding.score.jaccardSimilarity).toBe(0);
  });

  test("skips invalid chunk ids", () => {
    const result = groundQuoteExtractionItem({
      documentId: "doc-5",
      statement: "anything",
      quote: null,
      chunks: [
        {
          id: "   ",
          orderInFile: 1,
          text: "text",
          xpathStart: null,
          xpathEnd: null,
        },
      ],
    });

    const grounding = result._unsafeUnwrap();

    expect(grounding.documentId).toBe("doc-5");
    expect(grounding.chunks).toEqual([]);
    expect(grounding.score.bm25).toBe(0);
    expect(grounding.score.jaccardSimilarity).toBe(0);
  });

  test("grounds the messy quote fixture", () => {
    const result = groundQuoteExtractionItem({
      documentId: "doc-messy-quote",
      statement:
        "Provides guidance to enhance the requirements of aggregation and disaggregation",
      quote:
        "The Company labels items as‘other’ only if it cannot find a more informative label.",
      chunks: [
        {
          id: "chunk-2",
          orderInFile: 2,
          text: messyQuotes,
          xpathStart: "/html/body/div[1]",
          xpathEnd: "/html/body/div[1]",
        },
        {
          id: "chunk-1",
          orderInFile: 1,
          text: "Intro text",
          xpathStart: "/html/body/div[0]",
          xpathEnd: "/html/body/div[0]",
        },
      ],
    });

    const grounding = result.match(
      (value) => value,
      (error) => {
        throw new Error(`unexpected error: ${JSON.stringify(error)}`);
      },
    );

    expect(grounding.documentId).toBe("doc-messy-quote");
    expect(grounding.chunks.map((chunk) => chunk.id)).toEqual([
      "chunk-1",
      "chunk-2",
    ]);
    expect(grounding.score.bm25).toBeGreaterThan(0.3);
    expect(grounding.score.jaccardSimilarity).toBeGreaterThan(0.3);
  });
});
