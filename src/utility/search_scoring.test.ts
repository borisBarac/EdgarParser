import { describe, expect, test } from "bun:test";
import { bm25ToSearchScore } from "./search_scoring";

describe("bm25ToSearchScore", () => {
  test("maps zero to the minimum score", () => {
    expect(bm25ToSearchScore(0)).toBe(1);
  });

  test("maps a mid-range score linearly", () => {
    expect(bm25ToSearchScore(5)).toBe(51);
  });

  test("caps scores above the configured range", () => {
    expect(bm25ToSearchScore(25)).toBe(100);
  });

  test("rejects invalid inputs by returning the minimum score", () => {
    expect(bm25ToSearchScore(Number.NaN)).toBe(1);
    expect(bm25ToSearchScore(2, 0)).toBe(1);
  });
});
