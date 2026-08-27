import { normalizeWhitespace } from "./text";

export { normalizeWhitespace } from "./text";

export const htmlToVisibleText = (html: string): string =>
  normalizeWhitespace(html.replace(/<[^>]+>/g, " "));
