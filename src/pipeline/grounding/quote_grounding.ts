import { ok, type Result } from "neverthrow";
import {
  htmlToVisibleText,
  normalizeWhitespace,
} from "../../utility/html_text";
import { searchDocuments } from "../../utility/search";
import { bm25ToSearchScore } from "../../utility/search_scoring";
import { jaccardSimilarity } from "../../utility/similarity";
import type { Grounding } from "./model";

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
  const parts = [input.quote, input.statement]
    .filter((part): part is string => typeof part === "string")
    .map(normalizeWhitespace)
    .filter((part) => part.length > 0);

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

type GroundingScore = NonNullable<Grounding>["score"];

const scoreCorpus = (query: string, corpus: string): GroundingScore => {
  if (query.trim().length === 0 || corpus.trim().length === 0) {
    return {
      bm25: 0,
      jaccardSimilarity: 0,
    };
  }

  const bm25 = searchDocuments(
    [{ id: "combined", text: corpus }],
    query,
    1,
  ).match(
    (results) => results[0]?.score ?? 0,
    () => 0,
  );

  return {
    bm25: bm25ToSearchScore(bm25),
    jaccardSimilarity: jaccardSimilarity(query, corpus),
  };
};

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
    score: scoreCorpus(queryText, corpus),
  };

  return ok(grounding);
};
