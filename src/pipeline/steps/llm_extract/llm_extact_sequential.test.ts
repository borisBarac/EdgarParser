import { describe, expect, test } from "bun:test";

import type { FileGraph } from "../../../db/repo";
import { runSequentialExtraction } from "./llm_extract";

describe("runSequentialExtraction", () => {
  test("runs chunks in order and flattens results", async () => {
    const tick = async (): Promise<void> => {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    };

    const chunks = [
      { orderInFile: 0 },
      { orderInFile: 1 },
      { orderInFile: 2 },
    ] as unknown as FileGraph["chunks"];

    const events: string[] = [];
    const resolvers: Array<(value: readonly number[]) => void> = [];

    const promise = runSequentialExtraction(chunks, async (chunk) => {
      events.push(`start:${chunk.orderInFile}`);

      return await new Promise<readonly number[]>((resolve) => {
        resolvers.push((value) => {
          events.push(`resolve:${chunk.orderInFile}`);
          resolve(value);
        });
      });
    });

    expect(events).toEqual(["start:0"]);

    resolvers[0]?.([0]);
    await tick();

    expect(events).toEqual(["start:0", "resolve:0", "start:1"]);

    resolvers[1]?.([1, 2]);
    await tick();

    expect(events).toEqual([
      "start:0",
      "resolve:0",
      "start:1",
      "resolve:1",
      "start:2",
    ]);

    resolvers[2]?.([3]);

    await expect(promise).resolves.toEqual([0, 1, 2, 3]);
  });
});
