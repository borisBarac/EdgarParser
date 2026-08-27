import { describe, expect, test } from "bun:test";
import { messyTable } from "./cases";
import { groundTableExtractionItem } from "./table_grounding";

describe("groundTableExtractionItem", () => {
  test("grounds using title, labels, and raw values", () => {
    const result = groundTableExtractionItem(
      {
        title: "Income Statement",
        currency: null,
        scale: null,
        rows: [
          {
            label: "Revenue",
            values: [{ raw: "100" }],
          },
        ],
      },
      {
        documentId: "doc-1",
        xpath: "/html/body/table[1]",
        html: "<table><tbody><tr><td><span>Revenue</span></td><td>100</td></tr></tbody></table>",
      },
    );

    const grounding = result.match(
      (value) => value,
      (error) => {
        throw new Error(`unexpected error: ${JSON.stringify(error)}`);
      },
    );

    expect(grounding.documentId).toBe("doc-1");
    expect(grounding.chunks).toEqual([
      {
        id: "/html/body/table[1]",
        chunkXpathStart: "/html/body/table[1]",
        chunkXpathEnd: "/html/body/table[1]",
      },
    ]);
    expect(grounding.score.bm25).toBeGreaterThan(0.3);
    expect(grounding.score.jaccardSimilarity).toBeGreaterThan(0.3);
  });

  test("grounds blank query text with zero score", () => {
    const result = groundTableExtractionItem(
      {
        title: "   ",
        currency: null,
        scale: null,
        rows: [],
      },
      {
        documentId: "doc-5",
        xpath: "/html/body/table[5]",
        html: "<table><tbody><tr><td>Revenue</td><td>100</td></tr></tbody></table>",
      },
    );

    const grounding = result._unsafeUnwrap();

    expect(grounding.documentId).toBe("doc-5");
    expect(grounding.score.bm25).toBe(0);
    expect(grounding.score.jaccardSimilarity).toBe(0);
  });

  test("grounds corrupted extraction data with zero score", () => {
    const result = groundTableExtractionItem(
      {
        title: null,
        currency: null,
        scale: null,
        rows: [
          {
            label: "   ",
            values: [{ raw: "   " }],
          },
        ],
      },
      {
        documentId: "doc-5b",
        xpath: "/html/body/table[5b]",
        html: "<table><tbody><tr><td>Revenue</td><td>100</td></tr></tbody></table>",
      },
    );

    const grounding = result._unsafeUnwrap();

    expect(grounding.documentId).toBe("doc-5b");
    expect(grounding.score.bm25).toBe(0);
    expect(grounding.score.jaccardSimilarity).toBe(0);
  });

  test("grounds empty table text with zero score", () => {
    const result = groundTableExtractionItem(
      {
        title: "Revenue",
        currency: null,
        scale: null,
        rows: [
          {
            label: "Revenue",
            values: [{ raw: "100" }],
          },
        ],
      },
      {
        documentId: "doc-6",
        xpath: "/html/body/table[6]",
        html: "<table><tbody><tr><td>   </td></tr></tbody></table>",
      },
    );

    const grounding = result._unsafeUnwrap();

    expect(grounding.documentId).toBe("doc-6");
    expect(grounding.score.bm25).toBe(0);
    expect(grounding.score.jaccardSimilarity).toBe(0);
  });

  test("ignores currency and scale in scoring", () => {
    const result = groundTableExtractionItem(
      {
        title: null,
        currency: "USD",
        scale: 1000,
        rows: [
          {
            label: "Revenue",
            values: [{ raw: "1000" }],
          },
        ],
      },
      {
        documentId: "doc-7",
        xpath: "/html/body/table[7]",
        html: "<table><tbody><tr><td>Revenue</td><td>1000</td></tr></tbody></table>",
      },
    );

    const grounding = result._unsafeUnwrap();
    expect(grounding.score.bm25).toBeGreaterThan(0.3);
    expect(grounding.score.jaccardSimilarity).toBeGreaterThan(0.3);
  });

  test("ignores html tags in the source table text", () => {
    const result = groundTableExtractionItem(
      {
        title: null,
        currency: null,
        scale: null,
        rows: [
          {
            label: "Revenue",
            values: [{ raw: "100" }],
          },
        ],
      },
      {
        documentId: "doc-8",
        xpath: "/html/body/table[8]",
        html: "<table><tbody><tr><td><span>Revenue</span></td><td><div>100</div></td></tr></tbody></table>",
      },
    );

    const grounding = result._unsafeUnwrap();
    expect(grounding.chunks[0]?.id).toBe("/html/body/table[8]");
    expect(grounding.score.bm25).toBeGreaterThanOrEqual(1);
  });

  test("grounds the messy table fixture", () => {
    const result = groundTableExtractionItem(
      {
        title: "ASSETS",
        currency: null,
        scale: null,
        rows: [
          {
            label: "CURRENT ASSETS",
            values: [{ raw: "June 30, 2024" }],
          },
        ],
      },
      {
        documentId: "doc-messy-table",
        xpath: "/html/body/table[1]",
        html: messyTable,
      },
    );

    const grounding = result.match(
      (value) => value,
      (error) => {
        throw new Error(`unexpected error: ${JSON.stringify(error)}`);
      },
    );

    expect(grounding.documentId).toBe("doc-messy-table");
    expect(grounding.chunks).toEqual([
      {
        id: "/html/body/table[1]",
        chunkXpathStart: "/html/body/table[1]",
        chunkXpathEnd: "/html/body/table[1]",
      },
    ]);
    expect(grounding.score.bm25).toBeGreaterThan(0.3);
    expect(grounding.score.jaccardSimilarity).toBeGreaterThan(0.3);
  });
});
