export const normalizeWhitespace = (value: string): string =>
  value.replace(/\s+/g, " ").trim();

export const htmlToVisibleText = (html: string): string =>
  normalizeWhitespace(html.replace(/<[^>]+>/g, " "));
