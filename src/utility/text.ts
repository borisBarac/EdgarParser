const tokenPattern = /[a-z0-9]+/gi;

export const normalizeWhitespace = (value: string): string =>
  value.replace(/\s+/g, " ").trim();

export const tokenize = (value: string): readonly string[] =>
  value.match(tokenPattern)?.map((token) => token.toLowerCase()) ?? [];
