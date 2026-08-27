import { err, ok, type Result } from "neverthrow";
import { toInvalidInputError } from "./repo.errors";
import type {
  NormalizedSaveChunkInput,
  NormalizedSaveFileGraphInput,
  NormalizedSaveTableInput,
  RepoError,
  SaveFileGraphInput,
} from "./repo.types";
import { sortByOrderInFile } from "./repo.utils";

const validateOrder = (
  field: string,
  value: number,
): Result<number, RepoError> => {
  if (!Number.isInteger(value) || value < 0) {
    return err(toInvalidInputError(field, "must be a non-negative integer."));
  }

  return ok(value);
};

const validateTrimmedField = (
  field: string,
  value: string,
): Result<string, RepoError> => {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return err(toInvalidInputError(field, "must be a non-empty string."));
  }

  return ok(trimmed);
};

const validatePreservedField = (
  field: string,
  value: string,
): Result<string, RepoError> => {
  if (value.trim().length === 0) {
    return err(toInvalidInputError(field, "must be a non-empty string."));
  }

  return ok(value);
};

const validateNullableOrder = (
  field: string,
  value: number | null,
): Result<number | null, RepoError> => {
  if (value === null) {
    return ok(null);
  }

  return validateOrder(field, value);
};

const validateUniqueOrders = <T extends { readonly orderInFile: number }>(
  items: readonly T[],
  duplicateError: (orderInFile: number) => RepoError,
): Result<void, RepoError> => {
  const seen = new Set<number>();

  for (const item of items) {
    if (seen.has(item.orderInFile)) {
      return err(duplicateError(item.orderInFile));
    }

    seen.add(item.orderInFile);
  }

  return ok(undefined);
};

export const validateSaveFileGraphInput = (
  input: SaveFileGraphInput,
): Result<NormalizedSaveFileGraphInput, RepoError> => {
  const normalizedOrgFilePath = validatePreservedField(
    "orgFilePath",
    input.orgFilePath,
  );

  if (normalizedOrgFilePath.isErr()) {
    return err(normalizedOrgFilePath.error);
  }

  const normalizedCleanFilePath = validatePreservedField(
    "cleanFilePath",
    input.cleanFilePath,
  );

  if (normalizedCleanFilePath.isErr()) {
    return err(normalizedCleanFilePath.error);
  }

  const normalizedChunks: NormalizedSaveChunkInput[] = [];

  for (const [index, chunk] of sortByOrderInFile(input.chunks).entries()) {
    const orderInFile = validateOrder(
      `chunks[${index}].orderInFile`,
      chunk.orderInFile,
    );

    if (orderInFile.isErr()) {
      return err(orderInFile.error);
    }

    const xpathStart = validateTrimmedField(
      `chunks[${index}].xpathStart`,
      chunk.xpathStart,
    );

    if (xpathStart.isErr()) {
      return err(xpathStart.error);
    }

    const xpathEnd = validateTrimmedField(
      `chunks[${index}].xpathEnd`,
      chunk.xpathEnd,
    );

    if (xpathEnd.isErr()) {
      return err(xpathEnd.error);
    }

    const text = validatePreservedField(`chunks[${index}].text`, chunk.text);

    if (text.isErr()) {
      return err(text.error);
    }

    normalizedChunks.push({
      xpathStart: xpathStart.value,
      xpathEnd: xpathEnd.value,
      orderInFile: orderInFile.value,
      text: text.value,
    });
  }

  const chunkOrderValidation = validateUniqueOrders(
    normalizedChunks,
    (orderInFile) => ({ type: "duplicate_chunk_order", orderInFile }),
  );

  if (chunkOrderValidation.isErr()) {
    return err(chunkOrderValidation.error);
  }

  const chunkOrders = new Set(
    normalizedChunks.map((chunk) => chunk.orderInFile),
  );

  const normalizedTables: NormalizedSaveTableInput[] = [];

  for (const [index, table] of sortByOrderInFile(input.tables).entries()) {
    const orderInFile = validateOrder(
      `tables[${index}].orderInFile`,
      table.orderInFile,
    );

    if (orderInFile.isErr()) {
      return err(orderInFile.error);
    }

    const xpath = validateTrimmedField(`tables[${index}].xpath`, table.xpath);

    if (xpath.isErr()) {
      return err(xpath.error);
    }

    const text = validatePreservedField(`tables[${index}].text`, table.text);

    if (text.isErr()) {
      return err(text.error);
    }

    const prevChunkOrderInFile = validateNullableOrder(
      `tables[${index}].prevChunkOrderInFile`,
      table.prevChunkOrderInFile,
    );

    if (prevChunkOrderInFile.isErr()) {
      return err(prevChunkOrderInFile.error);
    }

    const nextChunkOrderInFile = validateNullableOrder(
      `tables[${index}].nextChunkOrderInFile`,
      table.nextChunkOrderInFile,
    );

    if (nextChunkOrderInFile.isErr()) {
      return err(nextChunkOrderInFile.error);
    }

    normalizedTables.push({
      xpath: xpath.value,
      orderInFile: orderInFile.value,
      text: text.value,
      prevChunkOrderInFile: prevChunkOrderInFile.value,
      nextChunkOrderInFile: nextChunkOrderInFile.value,
    });
  }

  const tableOrderValidation = validateUniqueOrders(
    normalizedTables,
    (orderInFile) => ({ type: "duplicate_table_order", orderInFile }),
  );

  if (tableOrderValidation.isErr()) {
    return err(tableOrderValidation.error);
  }

  for (const table of normalizedTables) {
    if (
      table.prevChunkOrderInFile !== null &&
      !chunkOrders.has(table.prevChunkOrderInFile)
    ) {
      return err({
        type: "missing_chunk_reference",
        tableOrderInFile: table.orderInFile,
        reference: "prev",
        missingOrderInFile: table.prevChunkOrderInFile,
      });
    }

    if (
      table.nextChunkOrderInFile !== null &&
      !chunkOrders.has(table.nextChunkOrderInFile)
    ) {
      return err({
        type: "missing_chunk_reference",
        tableOrderInFile: table.orderInFile,
        reference: "next",
        missingOrderInFile: table.nextChunkOrderInFile,
      });
    }
  }

  return ok({
    orgFilePath: normalizedOrgFilePath.value,
    cleanFilePath: normalizedCleanFilePath.value,
    chunks: normalizedChunks,
    tables: normalizedTables,
  });
};
