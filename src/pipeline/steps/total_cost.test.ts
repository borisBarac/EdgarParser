import { describe, expect, test } from "bun:test";
import { okAsync } from "neverthrow";

describe("total cost step", () => {
  test("sums quote and table costs", async () => {
    const { addTotalCost } = await import("./total_cost");

    const result = addTotalCost({
      quotes: [
        {
          type: "guidance",
          statement: "one",
          quote: "one",
          grounding: undefined,
          cost: {
            inputTokens: 1,
            outputTokens: 2,
            totalTokens: 3,
            inputUsd: 0.01,
            outputUsd: 0.02,
            totalUsd: 0.03,
          },
        },
      ],
      tables: [
        {
          title: null,
          currency: null,
          scale: null,
          columns: [],
          rows: [],
          grounding: undefined,
          cost: {
            inputTokens: 4,
            outputTokens: 5,
            totalTokens: 9,
            inputUsd: 0.04,
            outputUsd: 0.05,
            totalUsd: 0.09,
          },
        },
      ],
    });

    expect(result.totalCost).toEqual({
      inputTokens: 5,
      outputTokens: 7,
      totalTokens: 12,
      inputUsd: 0.05,
      outputUsd: 0.07,
      totalUsd: 0.12,
    });
  });

  test("passes the summed model to the next step", async () => {
    const { addTotalCost } = await import("./total_cost");

    const seen: Array<{
      totalCost: {
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
        inputUsd: number;
        outputUsd: number;
        totalUsd: number;
      };
    }> = [];

    await okAsync({
      quotes: [],
      tables: [
        {
          title: null,
          currency: null,
          scale: null,
          columns: [],
          rows: [],
          grounding: undefined,
          cost: {
            inputTokens: 2,
            outputTokens: 3,
            totalTokens: 5,
            inputUsd: 0.02,
            outputUsd: 0.03,
            totalUsd: 0.05,
          },
        },
      ],
    })
      .map(addTotalCost)
      .andThen((model) => {
        seen.push({ totalCost: model.totalCost });

        return okAsync(undefined);
      });

    expect(seen[0]?.totalCost).toEqual({
      inputTokens: 2,
      outputTokens: 3,
      totalTokens: 5,
      inputUsd: 0.02,
      outputUsd: 0.03,
      totalUsd: 0.05,
    });
  });
});
