import type { Document, Element, Node } from "happy-dom";
import {
  err,
  errAsync,
  ok,
  okAsync,
  type Result,
  type ResultAsync,
} from "neverthrow";
import type {
  FileGraph,
  Repo,
  RepoError,
  SaveChunkInput,
  SaveFileGraphInput,
  SaveTableInput,
} from "../../db/repo";
import type { CleanedHtmlFile } from "../../html";
import {
  elementToXPath,
  type HtmlXPathError,
  parseHtmlDocument,
} from "../../html/xpath";
import { estimateStringTokens } from "../../token";
import { type FileManagerError, readFile } from "../../utility/file_manager";

export type ChunkStepError = Readonly<
  | {
      readonly type: "read_cleaned_html";
      readonly path: string;
      readonly cause: FileManagerError;
    }
  | {
      readonly type: "extract_file_graph";
      readonly path: string;
      readonly cause: BuildFileGraphError;
    }
  | {
      readonly type: "save_file_graph";
      readonly path: string;
      readonly cause: RepoError;
    }
  | {
      readonly type: "read_back_file_graph";
      readonly path: string;
      readonly cause: RepoError;
    }
  | {
      readonly type: "saved_graph_missing";
      readonly path: string;
    }
>;

type ChunkTooLargeError = Readonly<{
  readonly type: "chunk_too_large";
  readonly path: string;
  readonly orderInFile: number;
  readonly tokenCount: number;
  readonly maxTokens: number;
}>;

type FragmentPart = Readonly<{
  readonly kind: "fragment";
  readonly nodes: readonly Node[];
  readonly xpathStartElement: Element | null;
  readonly xpathEndElement: Element | null;
  readonly hasMeaningfulText: boolean;
}>;

type TablePart = Readonly<{
  readonly kind: "table";
  readonly node: Element;
}>;

type SplitPart = FragmentPart | TablePart;

type PendingTable = Readonly<{
  readonly xpath: string;
  readonly orderInFile: number;
  readonly text: string;
  readonly prevChunkOrderInFile: number | null;
}>;

type BuildFileGraphError = HtmlXPathError | ChunkTooLargeError;

const isElementNode = (node: Node): node is Element => node.nodeType === 1;

const normalizeWhitespace = (value: string): string =>
  value.replace(/\s+/g, " ").trim();

const serializeNodes = (document: Document, nodes: readonly Node[]): string => {
  const container = document.createElement("div");

  for (const node of nodes) {
    container.appendChild(node);
  }

  return container.innerHTML;
};

const splitNode = (node: Node): readonly SplitPart[] => {
  if (!isElementNode(node)) {
    return [
      {
        kind: "fragment",
        nodes: [node.cloneNode(true)],
        xpathStartElement: null,
        xpathEndElement: null,
        hasMeaningfulText:
          normalizeWhitespace(node.textContent ?? "").length > 0,
      },
    ];
  }

  if (node.localName === "table") {
    return [
      {
        kind: "table",
        node,
      },
    ];
  }

  const childParts = Array.from(node.childNodes).flatMap(splitNode);
  const parts: SplitPart[] = [];
  let fragmentNodes: Node[] = [];
  let fragmentLastElement: Element | null = null;
  let fragmentHasMeaningfulText = false;

  const flush = (): void => {
    if (fragmentNodes.length === 0) {
      return;
    }

    const clone = node.cloneNode(false) as Element;

    for (const childNode of fragmentNodes) {
      clone.appendChild(childNode);
    }

    parts.push({
      kind: "fragment",
      nodes: [clone],
      xpathStartElement: node,
      xpathEndElement: fragmentLastElement ?? node,
      hasMeaningfulText: fragmentHasMeaningfulText,
    });
    fragmentNodes = [];
    fragmentLastElement = null;
    fragmentHasMeaningfulText = false;
  };

  for (const childPart of childParts) {
    if (childPart.kind === "table") {
      flush();
      parts.push(childPart);
      continue;
    }

    fragmentNodes.push(...childPart.nodes);
    fragmentHasMeaningfulText ||= childPart.hasMeaningfulText;
    if (childPart.xpathEndElement !== null) {
      fragmentLastElement = childPart.xpathEndElement;
    }
  }

  flush();

  return parts;
};

const splitDocumentBody = (document: Document): readonly SplitPart[] =>
  Array.from(document.body.childNodes).flatMap(splitNode);

const buildSaveFileGraphInput = (
  input: CleanedHtmlFile,
  html: string,
): Result<SaveFileGraphInput, BuildFileGraphError> =>
  parseHtmlDocument(html).andThen((document) => {
    const splitParts = splitDocumentBody(document);
    const chunks: SaveChunkInput[] = [];
    const tables: SaveTableInput[] = [];
    const pendingTables: PendingTable[] = [];
    let chunkOrderInFile = 0;
    let tableOrderInFile = 0;
    let lastChunkOrderInFile: number | null = null;

    const flushChunk = (
      nodes: readonly Node[],
      xpathStartElement: Element | null,
      xpathEndElement: Element | null,
      hasMeaningfulText: boolean,
    ): Result<void, BuildFileGraphError> => {
      const serializedHtml = serializeNodes(document, nodes);

      if (!hasMeaningfulText) {
        return ok(undefined);
      }

      const tokenCount = estimateStringTokens(serializedHtml);

      if (tokenCount > 50000) {
        return err({
          type: "chunk_too_large",
          path: input.cleanedFilePath,
          orderInFile: chunkOrderInFile,
          tokenCount,
          maxTokens: 50000,
        });
      }

      // Boundary xpaths anchor to the surviving wrapper element, not the exact
      // first/last descendant inside it. Good enough for stable sibling indexes.
      const xpathStart =
        xpathStartElement === null
          ? "/html/body"
          : elementToXPath(xpathStartElement);
      const xpathEnd =
        xpathEndElement === null
          ? "/html/body"
          : elementToXPath(xpathEndElement);

      const currentChunkOrderInFile = chunkOrderInFile;
      chunkOrderInFile += 1;

      chunks.push({
        xpathStart,
        xpathEnd,
        orderInFile: currentChunkOrderInFile,
        text: serializedHtml,
      });

      for (const table of pendingTables) {
        tables.push({
          xpath: table.xpath,
          orderInFile: table.orderInFile,
          text: table.text,
          prevChunkOrderInFile: table.prevChunkOrderInFile,
          nextChunkOrderInFile: currentChunkOrderInFile,
        });
      }

      pendingTables.length = 0;
      lastChunkOrderInFile = currentChunkOrderInFile;

      return ok(undefined);
    };

    for (const part of splitParts) {
      if (part.kind === "table") {
        pendingTables.push({
          xpath: elementToXPath(part.node),
          orderInFile: tableOrderInFile,
          text: part.node.outerHTML,
          prevChunkOrderInFile: lastChunkOrderInFile,
        });
        tableOrderInFile += 1;
        continue;
      }

      const flushResult = flushChunk(
        part.nodes,
        part.xpathStartElement,
        part.xpathEndElement,
        part.hasMeaningfulText,
      );

      if (flushResult.isErr()) {
        return err(flushResult.error);
      }
    }

    for (const table of pendingTables) {
      tables.push({
        xpath: table.xpath,
        orderInFile: table.orderInFile,
        text: table.text,
        prevChunkOrderInFile: table.prevChunkOrderInFile,
        nextChunkOrderInFile: null,
      });
    }

    return ok({
      orgFilePath: input.originalFilePath,
      cleanFilePath: input.cleanedFilePath,
      chunks,
      tables,
    });
  });

const readCleanedHtmlError = (
  path: string,
  cause: FileManagerError,
): ChunkStepError => ({
  type: "read_cleaned_html",
  path,
  cause,
});

const extractFileGraphError = (
  path: string,
  cause: BuildFileGraphError,
): ChunkStepError => ({
  type: "extract_file_graph",
  path,
  cause,
});

const saveFileGraphError = (
  path: string,
  cause: RepoError,
): ChunkStepError => ({
  type: "save_file_graph",
  path,
  cause,
});

const readBackFileGraphError = (
  path: string,
  cause: RepoError,
): ChunkStepError => ({
  type: "read_back_file_graph",
  path,
  cause,
});

const savedGraphMissingError = (path: string): ChunkStepError => ({
  type: "saved_graph_missing",
  path,
});

export const chunk = (
  repo: Repo,
  input: CleanedHtmlFile,
): ResultAsync<FileGraph, ChunkStepError> =>
  readFile(input.cleanedFilePath)
    .mapErr((cause) => readCleanedHtmlError(input.cleanedFilePath, cause))
    .andThen((html) =>
      buildSaveFileGraphInput(input, html).mapErr((cause) =>
        extractFileGraphError(input.cleanedFilePath, cause),
      ),
    )
    .andThen((saveInput) =>
      repo
        .saveFileGraph(saveInput)
        .mapErr((cause) => saveFileGraphError(input.originalFilePath, cause)),
    )
    .andThen(() =>
      repo
        .getFileGraphByOrgPath(input.originalFilePath)
        .mapErr((cause) =>
          readBackFileGraphError(input.originalFilePath, cause),
        ),
    )
    .andThen((fileGraph) =>
      fileGraph === null
        ? errAsync(savedGraphMissingError(input.originalFilePath))
        : okAsync(fileGraph),
    );
