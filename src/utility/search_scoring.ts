const MIN_SEARCH_SCORE = 1;
const MAX_SEARCH_SCORE = 100;
const DEFAULT_MAX_BM25_SCORE = 10;

// Linear BM25 -> 1..100 mapping. The max BM25 value is a practical cap, not a mathematical one.
export const bm25ToSearchScore = (
  bm25Score: number,
  maxBm25Score = DEFAULT_MAX_BM25_SCORE,
): number => {
  if (
    !Number.isFinite(bm25Score) ||
    !Number.isFinite(maxBm25Score) ||
    maxBm25Score <= 0
  ) {
    return MIN_SEARCH_SCORE;
  }

  const normalizedScore = Math.max(0, Math.min(1, bm25Score / maxBm25Score));

  return Math.round(
    MIN_SEARCH_SCORE + normalizedScore * (MAX_SEARCH_SCORE - MIN_SEARCH_SCORE),
  );
};

export default bm25ToSearchScore;
