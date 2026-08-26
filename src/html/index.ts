import { basename, dirname, extname, join } from "node:path";
import { type CheerioAPI, load } from "cheerio";
import { err, errAsync, ok, type Result, type ResultAsync } from "neverthrow";
import {
  type FileManagerError,
  readFile,
  writeFile,
} from "../utility/file_manager";

export type HtmlCleanupError = Readonly<{
  readonly type: "missing_text_boundary";
  readonly side: "open" | "close" | "mismatch";
}>;

export type CleanedHtmlFile = Readonly<{
  readonly originalFilePath: string;
  readonly cleanedFilePath: string;
}>;

const textOpenTag = "<text>";
const textCloseTag = "</text>";

const bannedSelectors = [
  "script",
  "style",
  "img",
  "svg",
  "picture",
  "source",
] as const;

const protectedTags = new Set([
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "td",
  "th",
  "ul",
  "ol",
  "li",
  "dl",
  "dt",
  "dd",
  "caption",
  "colgroup",
  "col",
  "br",
  "hr",
]);

const splitTextEnvelope = (
  html: string,
): Result<
  Readonly<{
    readonly prefix: string;
    readonly inner: string;
    readonly suffix: string;
  }>,
  HtmlCleanupError
> => {
  const openIndex = html.indexOf(textOpenTag);
  const closeIndex = html.lastIndexOf(textCloseTag);

  if (openIndex === -1 && closeIndex === -1) {
    return ok({ prefix: "", inner: html, suffix: "" });
  }

  if (openIndex === -1) {
    return err({ type: "missing_text_boundary", side: "open" });
  }

  if (closeIndex === -1) {
    return err({ type: "missing_text_boundary", side: "close" });
  }

  if (openIndex > closeIndex) {
    return err({ type: "missing_text_boundary", side: "mismatch" });
  }

  return ok({
    prefix: html.slice(0, openIndex + textOpenTag.length),
    inner: html.slice(openIndex + textOpenTag.length, closeIndex),
    suffix: html.slice(closeIndex),
  });
};

const removeBannedNodes = ($: CheerioAPI): void => {
  for (const selector of bannedSelectors) {
    $(selector).remove();
  }
};

const stripInlineStyles = ($: CheerioAPI): void => {
  $("[style]").each((_, element) => {
    $(element).removeAttr("style");
  });
};

const pruneEmptyWrappers = ($: CheerioAPI): void => {
  for (;;) {
    let removed = false;

    const elements = $.root().find("*").toArray().reverse();

    for (const element of elements) {
      if (element.type !== "tag") {
        continue;
      }

      const tagName = element.tagName.toLowerCase();

      if (protectedTags.has(tagName)) {
        continue;
      }

      if ($(element).text().trim().length > 0) {
        continue;
      }

      if ($(element).children().length > 0) {
        continue;
      }

      $(element).remove();
      removed = true;
    }

    if (!removed) {
      return;
    }
  }
};

const cleanFragment = (fragment: string): string => {
  const $ = load(fragment, undefined, false);

  removeBannedNodes($);
  stripInlineStyles($);
  pruneEmptyWrappers($);

  return $.root().html() ?? "";
};

const cleanHtmlParts = (
  html: string,
): Result<
  Readonly<{
    readonly prefix: string;
    readonly inner: string;
    readonly suffix: string;
  }>,
  HtmlCleanupError
> =>
  splitTextEnvelope(html).map((parts) => ({
    prefix: parts.prefix,
    inner: cleanFragment(parts.inner),
    suffix: parts.suffix,
  }));

export const cleanHtml = (html: string): Result<string, HtmlCleanupError> =>
  cleanHtmlParts(html).map(
    ({ prefix, inner, suffix }) => `${prefix}${inner}${suffix}`,
  );

const cleanedFilePath = (originalFilePath: string): string => {
  const ext = extname(originalFilePath) || ".html";
  const name = basename(originalFilePath, ext);

  return join(dirname(originalFilePath), `${name}_cleaned${ext}`);
};

export const cleanHtmlFile = (
  originalFilePath: string,
): ResultAsync<CleanedHtmlFile, HtmlCleanupError | FileManagerError> => {
  const targetFilePath = cleanedFilePath(originalFilePath);

  return readFile(originalFilePath).andThen((html) =>
    cleanHtml(html).match(
      (cleanedHtml) =>
        writeFile(targetFilePath, cleanedHtml).map(() => ({
          originalFilePath,
          cleanedFilePath: targetFilePath,
        })),
      (error) => errAsync(error),
    ),
  );
};

export type { HtmlXPathError } from "./xpath";
export { getHtmlElementAtXPath, getTagXPaths } from "./xpath";
