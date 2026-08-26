import { describe, expect, it } from "bun:test";

import { calculateCost, resolveModelName } from "./cost";

describe("agent helpers", () => {
  it("resolves model name", () => {
    expect(
      resolveModelName(
        { miniModel: "gpt-5.4-mini", mainModel: "gpt-5.4" },
        "mini",
      ),
    ).toBe("gpt-5.4-mini");
    expect(
      resolveModelName(
        { miniModel: "gpt-5.4-mini", mainModel: "gpt-5.4" },
        "main",
      ),
    ).toBe("gpt-5.4");
  });

  it("calculates per-1M token cost", () => {
    expect(
      calculateCost(
        { inputTokens: 250_000, outputTokens: 100_000, totalTokens: 350_000 },
        { inputUsdPer1M: 0.75, outputUsdPer1M: 4.5 },
      ),
    ).toEqual({
      inputTokens: 250_000,
      outputTokens: 100_000,
      totalTokens: 350_000,
      inputUsd: 0.1875,
      outputUsd: 0.45,
      totalUsd: 0.6375,
    });
  });
});
