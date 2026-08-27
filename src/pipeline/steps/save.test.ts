import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

const tempRoot = resolve(
  "/var/folders/xp/2fyz9z3j7mgfzfkdtpcn95kr0000gn/T/opencode",
  `save-step-${crypto.randomUUID()}`,
);

beforeAll(async () => {
  await mkdir(tempRoot, { recursive: true });
});

afterAll(async () => {
  await rm(tempRoot, { recursive: true, force: true });
});

describe("save step", () => {
  test("writes a pretty-printed pipeline model", async () => {
    const { PipelineModelSchema } = await import("../model");
    const { save } = await import("./save");

    const outputPath = join(tempRoot, "model.json");
    const model = PipelineModelSchema.parse({
      quotes: [
        {
          type: "guidance",
          statement: "statement",
          quote: "quote",
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
      tables: [],
    });

    const result = await save(model, outputPath);

    await result.match(
      () => null,
      (error) => {
        throw new Error(`unexpected error: ${JSON.stringify(error)}`);
      },
    );

    expect(await Bun.file(outputPath).text()).toBe(
      JSON.stringify(model, null, 2),
    );
  });

  test("returns a typed error when writing fails", async () => {
    const { PipelineModelSchema } = await import("../model");
    const { save } = await import("./save");

    const model = PipelineModelSchema.parse({ quotes: [], tables: [] });
    const result = await save(model, tempRoot);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.type).toBe("save_pipeline_model_failed");
      expect(result.error.path).toBe(tempRoot);
      expect(result.error.cause.type).toBe("write_file");
    }
  });
});
