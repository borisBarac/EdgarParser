const tokenize = (value: string): readonly string[] =>
  value.match(/[a-z0-9]+/gi)?.map((token) => token.toLowerCase()) ?? [];

const uniqueTokens = (value: string): ReadonlySet<string> =>
  new Set(tokenize(value));

export const jaccardSimilarity = (left: string, right: string): number => {
  const leftTokens = uniqueTokens(left);
  const rightTokens = uniqueTokens(right);

  if (leftTokens.size === 0 && rightTokens.size === 0) {
    return 1;
  }

  let intersectionSize = 0;
  let unionSize = leftTokens.size;

  for (const token of rightTokens) {
    if (leftTokens.has(token)) {
      intersectionSize += 1;
    } else {
      unionSize += 1;
    }
  }

  return intersectionSize / unionSize;
};

export default jaccardSimilarity;
