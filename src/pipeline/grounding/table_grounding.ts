import { ok, type Result } from "neverthrow";
import { htmlToVisibleText } from "../../utility/html_text";
import { normalizeWhitespace } from "../../utility/text";
import type { Grounding } from "./model";
import { scoreGroundingText } from "./score";

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

export type GroundTableError = never;

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

export const groundTableExtractionItem = (
  extraction: GroundTableExtractionInput,
  source: GroundTableSourceInput,
): Result<NonNullable<Grounding>, GroundTableError> => {
  const query = buildQueryText(extraction);
  const corpus = buildCorpus(source);

  return ok({
    documentId: source.documentId,
    chunks: [
      {
        id: source.xpath,
        chunkXpathStart: source.xpath,
        chunkXpathEnd: source.xpath,
      },
    ],
    score: scoreGroundingText(query, corpus),
  });
};
