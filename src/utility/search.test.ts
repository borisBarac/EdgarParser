import { describe, expect, test } from "bun:test";
import { createSearchIndex } from "./search";

describe("search", () => {
  test("ranks the best matching document first", () => {
    const indexResult = createSearchIndex([
      { id: "a", text: "red apple apple orchard" },
      { id: "b", text: "yellow banana orchard" },
      { id: "c", text: "plain stone" },
    ]);

    const index = indexResult.match(
      (value) => value,
      (error) => {
        throw new Error(`unexpected error: ${JSON.stringify(error)}`);
      },
    );

    const results = index.search("apple orchard");

    expect(results.map((result) => result.id)).toEqual(["a", "b"]);
    expect(results[0]?.score).toBeGreaterThan(results[1]?.score ?? 0);
    expect(results[0]?.score).toBeGreaterThan(0);
  });

  test("search limit truncates results", () => {
    const index = createSearchIndex([
      { id: "a", text: "alpha beta gamma" },
      { id: "b", text: "alpha gamma" },
      { id: "c", text: "alpha" },
    ]).match(
      (value) => value,
      (error) => {
        throw new Error(`unexpected error: ${JSON.stringify(error)}`);
      },
    );

    const results = index.search("alpha", 2);

    expect(results).toHaveLength(2);
    expect(results.map((result) => result.id)).toEqual(["c", "b"]);
  });

  test("blank queries return no results", () => {
    const index = createSearchIndex([{ id: "a", text: "one two three" }]).match(
      (value) => value,
      (error) => {
        throw new Error(`unexpected error: ${JSON.stringify(error)}`);
      },
    );

    expect(index.search("   ")).toEqual([]);
  });

  test("duplicate ids are rejected", () => {
    const result = createSearchIndex([
      { id: "a", text: "first text" },
      { id: "a", text: "second text" },
    ]);

    const error = result.match(
      () => null,
      (value) => value,
    );

    expect(error?.type).toBe("duplicate_id");
  });
});
