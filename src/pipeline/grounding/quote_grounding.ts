import { ok, type Result } from "neverthrow";
import { htmlToVisibleText } from "../../utility/html_text";
import { normalizeWhitespace } from "../../utility/text";
import type { Grounding } from "./model";
import { scoreGroundingText } from "./score";

export type GroundingChunkInput = Readonly<{
  id: string;
  orderInFile: number;
  text: string;
  xpathStart: string | null;
  xpathEnd: string | null;
}>;

export type GroundQuoteInput = Readonly<{
  documentId: string;
  statement: string;
  quote: string | null;
  chunks: readonly GroundingChunkInput[];
}>;

export type GroundQuoteError = never;

const buildQueryText = (input: GroundQuoteInput): string => {
  const parts: string[] = [];

  if (input.quote !== null) {
    const quote = normalizeWhitespace(input.quote);
    if (quote.length > 0) parts.push(quote);
  }

  const statement = normalizeWhitespace(input.statement);
  if (statement.length > 0) parts.push(statement);

  return normalizeWhitespace(parts.join(" \n "));
};

const sortChunks = (
  chunks: readonly GroundingChunkInput[],
): readonly GroundingChunkInput[] =>
  [...chunks].sort((left, right) => left.orderInFile - right.orderInFile);

const buildCorpus = (chunks: readonly GroundingChunkInput[]): string =>
  normalizeWhitespace(
    chunks.map((chunk) => htmlToVisibleText(chunk.text)).join(" \n "),
  );

const validateChunks = (
  chunks: readonly GroundingChunkInput[],
): readonly GroundingChunkInput[] =>
  sortChunks(chunks.filter((chunk) => chunk.id.trim().length > 0));

export const groundQuoteExtractionItem = (
  input: GroundQuoteInput,
): Result<NonNullable<Grounding>, GroundQuoteError> => {
  const chunks = validateChunks(input.chunks);
  const queryText = buildQueryText(input);
  const corpus = buildCorpus(chunks);

  const grounding: NonNullable<Grounding> = {
    documentId: input.documentId,
    chunks: chunks.map((chunk) => ({
      id: chunk.id,
      chunkXpathStart: chunk.xpathStart,
      chunkXpathEnd: chunk.xpathEnd,
    })),
    score: scoreGroundingText(queryText, corpus),
  };

  return ok(grounding);
};
