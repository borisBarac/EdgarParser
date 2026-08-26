import { describe, expect, test } from "bun:test";
import { estimateStringTokens } from "./index";

describe("token", () => {
  test("counts empty text as zero tokens", () => {
    expect(estimateStringTokens("")).toBe(0);
  });

  test("counts non-empty text", () => {
    expect(
      estimateStringTokens("Some potentially very long string..."),
    ).toBeGreaterThan(0);
  });
});
