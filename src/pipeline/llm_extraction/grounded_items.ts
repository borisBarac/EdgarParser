import { okAsync, type Result, type ResultAsync } from "neverthrow";
import type { ZodType } from "zod";
import { logValue } from "../../utility/debug";

type GroundedItemInput<TItem, TGrounding, TOutput> = Readonly<{
  label: string;
  items: readonly TItem[];
  schema: ZodType<TOutput[]>;
  describeItem: (item: TItem) => Readonly<Record<string, unknown>>;
  groundItem: (item: TItem) => Result<TGrounding | undefined, unknown>;
  buildItem: (item: TItem, grounding: TGrounding | undefined) => TOutput;
}>;

const logGroundedItem = <T>(label: string, value: T): T =>
  logValue(
    `--- src/pipeline/llm_extraction/grounded_items.ts: ${label} ---`,
    value,
  );

export const groundItems = <TItem, TGrounding, TOutput>(
  input: GroundedItemInput<TItem, TGrounding, TOutput>,
): ResultAsync<TOutput[], never> => {
  const groundedItems = input.items.map((item) => {
    const grounding = input.groundItem(item).match(
      (value) => value,
      (error) => {
        logGroundedItem(`${input.label}.groundingFailed`, {
          ...input.describeItem(item),
          error,
        });

        return undefined;
      },
    );

    logGroundedItem(`${input.label}.grounding`, grounding);

    const groundedItem = input.buildItem(item, grounding);
    logGroundedItem(`${input.label}.groundedItem`, groundedItem);

    return groundedItem;
  });

  logGroundedItem(`${input.label}.groundedItems`, groundedItems);

  return okAsync(
    logGroundedItem(
      `${input.label}.parsedGroundedItems`,
      input.schema.parse(groundedItems),
    ),
  );
};
