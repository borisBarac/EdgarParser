import { describe, expect, test } from "bun:test";
import { jaccardSimilarity } from "./similarity";

describe("jaccardSimilarity", () => {
  test("returns 1 for identical text", () => {
    expect(jaccardSimilarity("hello world", "hello world")).toBe(1);
  });

  test("matches the example output", () => {
    expect(jaccardSimilarity("hello world", "hello universe")).toBeCloseTo(
      1 / 3,
    );
  });

  test("returns 0 for disjoint text", () => {
    expect(jaccardSimilarity("alpha beta", "gamma delta")).toBe(0);
  });

  test("treats empty text as fully similar", () => {
    expect(jaccardSimilarity("", "")).toBe(1);
  });
});
