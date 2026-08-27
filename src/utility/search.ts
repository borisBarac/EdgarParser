import { err, ok, type Result } from "neverthrow";
import { tokenize } from "./text";

export type SearchDocument = Readonly<{
  id: string;
  text: string;
}>;

export type SearchResult = Readonly<{
  id: string;
  text: string;
  score: number;
}>;

export type SearchError = Readonly<{
  type: "invalid_document" | "duplicate_id";
  index: number;
  id?: string;
  message: string;
}>;

type PreparedDocument = Readonly<{
  document: SearchDocument;
  termFrequency: ReadonlyMap<string, number>;
  length: number;
  index: number;
}>;

export type SearchIndex = Readonly<{
  search(query: string, limit?: number): readonly SearchResult[];
}>;

const fieldName = "text";
const k1 = 1.2;
const b = 0.75;

const countTerms = (tokens: readonly string[]): ReadonlyMap<string, number> => {
  const termFrequency = new Map<string, number>();

  for (const token of tokens) {
    termFrequency.set(token, (termFrequency.get(token) ?? 0) + 1);
  }

  return termFrequency;
};

const validateDocument = (
  document: SearchDocument,
  index: number,
): Result<SearchDocument, SearchError> => {
  if (typeof document.id !== "string" || document.id.trim().length === 0) {
    return err({
      type: "invalid_document",
      index,
      id: document.id,
      message: "Search documents must have a non-empty string id.",
    });
  }

  if (typeof document.text !== "string") {
    return err({
      type: "invalid_document",
      index,
      id: document.id,
      message: `Search documents must have a string ${fieldName} field.`,
    });
  }

  return ok({
    id: document.id,
    text: document.text,
  });
};

const prepareDocuments = (
  documents: readonly SearchDocument[],
): Result<readonly PreparedDocument[], SearchError> => {
  const seenIds = new Set<string>();
  const preparedDocuments: PreparedDocument[] = [];

  for (const [index, document] of documents.entries()) {
    const validated = validateDocument(document, index);
    if (validated.isErr()) {
      return err(validated.error);
    }

    const value = validated.value;
    if (seenIds.has(value.id)) {
      return err({
        type: "duplicate_id",
        index,
        id: value.id,
        message: "Search document ids must be unique.",
      });
    }

    seenIds.add(value.id);
    const tokens = tokenize(value.text);
    preparedDocuments.push({
      document: value,
      termFrequency: countTerms(tokens),
      length: tokens.length,
      index,
    });
  }

  return ok(preparedDocuments);
};

const computeIdf = (
  term: string,
  documents: readonly PreparedDocument[],
): number => {
  let documentFrequency = 0;

  for (const document of documents) {
    if (document.termFrequency.has(term)) {
      documentFrequency += 1;
    }
  }

  return Math.log(
    1 +
      (documents.length - documentFrequency + 0.5) / (documentFrequency + 0.5),
  );
};

const scoreDocument = (
  document: PreparedDocument,
  queryTerms: readonly string[],
  averageDocumentLength: number,
  documentFrequencies: ReadonlyMap<string, number>,
): number => {
  if (queryTerms.length === 0) {
    return 0;
  }

  let score = 0;
  const documentLengthFactor =
    1 - b + (b * document.length) / averageDocumentLength;

  for (const term of queryTerms) {
    const termFrequency = document.termFrequency.get(term) ?? 0;
    if (termFrequency === 0) {
      continue;
    }

    const idf = documentFrequencies.get(term) ?? 0;
    score +=
      idf *
      ((termFrequency * (k1 + 1)) /
        (termFrequency + k1 * documentLengthFactor));
  }

  return score;
};

const rankResults = (
  documents: readonly PreparedDocument[],
  query: string,
  limit?: number,
): readonly SearchResult[] => {
  const queryTerms = tokenize(query.trim());
  if (queryTerms.length === 0 || documents.length === 0) {
    return [];
  }

  const averageDocumentLength =
    documents.reduce((total, document) => total + document.length, 0) /
    documents.length;
  if (averageDocumentLength === 0) {
    return [];
  }
  const documentFrequencies = new Map(
    Array.from(new Set(queryTerms), (term) => [
      term,
      computeIdf(term, documents),
    ]),
  );

  const rankedResults = documents
    .map((document) => ({
      id: document.document.id,
      text: document.document.text,
      score: scoreDocument(
        document,
        queryTerms,
        averageDocumentLength,
        documentFrequencies,
      ),
      index: document.index,
    }))
    .filter((result) => result.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.index - right.index;
    })
    .map(({ index: _index, ...result }) => result);

  if (typeof limit !== "number") {
    return rankedResults;
  }

  return rankedResults.slice(0, Math.max(0, Math.trunc(limit)));
};

export const createSearchIndex = (
  documents: readonly SearchDocument[],
): Result<SearchIndex, SearchError> =>
  prepareDocuments(documents).map((preparedDocuments) => ({
    search: (query: string, limit?: number) =>
      rankResults(preparedDocuments, query, limit),
  }));

export const searchDocuments = (
  documents: readonly SearchDocument[],
  query: string,
  limit?: number,
): Result<readonly SearchResult[], SearchError> =>
  createSearchIndex(documents).map((index) => index.search(query, limit));

export default createSearchIndex;
