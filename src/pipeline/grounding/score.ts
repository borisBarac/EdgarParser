import { searchDocuments } from "../../utility/search";
import { bm25ToSearchScore } from "../../utility/search_scoring";
import { jaccardSimilarity } from "../../utility/similarity";

export type GroundingScore = Readonly<{
  bm25: number;
  jaccardSimilarity: number;
}>;

export const scoreGroundingText = (
  query: string,
  corpus: string,
): GroundingScore => {
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
