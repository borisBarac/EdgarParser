import { err, ok, type Result } from "neverthrow";
import {
  htmlToVisibleText,
  normalizeWhitespace,
} from "../../utility/html_text";
import { searchDocuments } from "../../utility/search";
import { bm25ToSearchScore } from "../../utility/search_scoring";
import { jaccardSimilarity } from "../../utility/similarity";
import type { Grounding } from "./model";

export type GroundTableRowValueInput = Readonly<{
  raw: string;
}>;

export type GroundTableRowInput = Readonly<{
  label: string;
  values: readonly GroundTableRowValueInput[];
}>;

export type GroundTableExtractionInput = Readonly<{
  title: string | null;
  currency: string | null;
  scale: number | null;
  rows: readonly GroundTableRowInput[];
}>;

export type GroundTableSourceInput = Readonly<{
  documentId: string;
  xpath: string;
  html: string;
}>;

export type GroundTableError = Readonly<
  | {
      type: "empty_query";
    }
  | {
      type: "empty_table";
    }
>;

const buildQueryText = (input: GroundTableExtractionInput): string => {
  const parts: string[] = [];

  if (input.title !== null) {
    const title = normalizeWhitespace(input.title);
    if (title.length > 0) {
      parts.push(title);
    }
  }

  for (const row of input.rows) {
    const label = normalizeWhitespace(row.label);
    if (label.length > 0) {
      parts.push(label);
    }

    for (const value of row.values) {
      const raw = normalizeWhitespace(value.raw);
      if (raw.length > 0) {
        parts.push(raw);
      }
    }
  }

  return normalizeWhitespace(parts.join(" \n "));
};

const buildCorpus = (input: GroundTableSourceInput): string =>
  htmlToVisibleText(input.html);

const scoreCorpus = (query: string, corpus: string) => {
  const bm25 = searchDocuments([{ id: "table", text: corpus }], query, 1).match(
    (results) => results[0]?.score ?? 0,
    () => 0,
  );

  return {
    bm25: bm25ToSearchScore(bm25),
    jaroWinkler: jaccardSimilarity(query, corpus),
  };
};

export const groundTableExtractionItem = (
  extraction: GroundTableExtractionInput,
  source: GroundTableSourceInput,
): Result<NonNullable<Grounding>, GroundTableError> => {
  const query = buildQueryText(extraction);
  if (query.length === 0) {
    return err({ type: "empty_query" } as const);
  }

  const corpus = buildCorpus(source);
  if (corpus.length === 0) {
    return err({ type: "empty_table" } as const);
  }

  return ok({
    documentId: source.documentId,
    chunks: [
      {
        id: source.xpath,
        chunkXpathStart: source.xpath,
        chunkXpathEnd: source.xpath,
      },
    ],
    score: scoreCorpus(query, corpus),
  });
};
