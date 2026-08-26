import { evaluateXPathToFirstNode } from "fontoxpath";
import { type Document, type Element, Window } from "happy-dom";
import { err, ok, type Result } from "neverthrow";

export type HtmlXPathError = Readonly<{
  readonly type: "parse_html" | "evaluate_xpath";
  readonly input: string;
  readonly cause: unknown;
}>;

export const parseHtmlDocument = (
  html: string,
): Result<Document, HtmlXPathError> => {
  try {
    const window = new Window();

    return ok(new window.DOMParser().parseFromString(html, "text/html"));
  } catch (cause: unknown) {
    const error: HtmlXPathError = { type: "parse_html", input: html, cause };

    return err(error);
  }
};

const sameTagSiblingIndex = (element: Element): number => {
  const tagName = element.localName;
  let index = 1;
  let previous = element.previousElementSibling;

  while (previous !== null) {
    if (previous.localName === tagName) {
      index += 1;
    }

    previous = previous.previousElementSibling;
  }

  return index;
};

const elementToXPath = (element: Element): string => {
  const segments: string[] = [];
  let current: Element | null = element;

  while (current !== null) {
    segments.push(
      `*[local-name()="${current.localName}"][${sameTagSiblingIndex(current)}]`,
    );
    current = current.parentElement;
  }

  return `/${segments.reverse().join("/")}`;
};

export const getHtmlElementAtXPath = (
  html: string,
  xpath: string,
): Result<Element | null, HtmlXPathError> =>
  parseHtmlDocument(html).andThen((document) => {
    try {
      const node = evaluateXPathToFirstNode<Node>(xpath, document);

      if (node === null || !("tagName" in node)) {
        return ok(null);
      }

      return ok(node as unknown as Element);
    } catch (cause: unknown) {
      const error: HtmlXPathError = {
        type: "evaluate_xpath",
        input: xpath,
        cause,
      };

      return err(error);
    }
  });

export const getTagXPaths = (
  html: string,
  tagName: string,
): Result<readonly string[], HtmlXPathError> =>
  parseHtmlDocument(html).map((document) => {
    const normalizedTagName = tagName.toLowerCase();
    const elements = Array.from(
      document.getElementsByTagName(normalizedTagName),
    );

    return elements.map((element) => elementToXPath(element));
  });

export { elementToXPath };
