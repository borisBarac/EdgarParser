import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { listFiles, readFile, writeFile } from "./file_manager";

const rootDir = resolve(
  "/var/folders/xp/2fyz9z3j7mgfzfkdtpcn95kr0000gn/T/opencode",
  `file-manager-${crypto.randomUUID()}`,
);

const directFileA = join(rootDir, "a.html");
const directFileB = join(rootDir, "b.html");
const nestedDir = join(rootDir, "nested");
const nestedFile = join(nestedDir, "c.html");

beforeAll(async () => {
  await mkdir(nestedDir, { recursive: true });
  await Bun.write(directFileA, "<p>a</p>");
  await Bun.write(directFileB, "<p>b</p>");
  await Bun.write(nestedFile, "<p>c</p>");
});

afterAll(async () => {
  await rm(rootDir, { recursive: true, force: true });
});

describe("file_manager", () => {
  test("listFiles returns full paths for direct files only", async () => {
    const result = await listFiles(rootDir);

    const files = await result.match(
      (value) => value,
      (error) => {
        throw new Error(`unexpected error: ${JSON.stringify(error)}`);
      },
    );

    expect([...files].sort()).toEqual([directFileA, directFileB].sort());
    expect(files).not.toContain(nestedFile);
  });

  test("readFile returns file contents", async () => {
    const result = await readFile(directFileA);

    const contents = await result.match(
      (value) => value,
      (error) => {
        throw new Error(`unexpected error: ${JSON.stringify(error)}`);
      },
    );

    expect(contents).toBe("<p>a</p>");
  });

  test("readFile returns an error for missing files", async () => {
    const result = await readFile(join(rootDir, "missing.html"));

    const error = await result.match(
      () => null,
      (value) => value,
    );

    expect(error?.type).toBe("read_file");
  });

  test("writeFile writes html and creates parent directories", async () => {
    const outputFile = join(rootDir, "deep", "tree", "page.html");
    const html = "<html><body><h1>hi</h1></body></html>";

    const writeResult = await writeFile(outputFile, html);

    const bytes = await writeResult.match(
      (value) => value,
      (error) => {
        throw new Error(`unexpected error: ${JSON.stringify(error)}`);
      },
    );

    expect(bytes).toBeGreaterThan(0);
    expect(await Bun.file(outputFile).text()).toBe(html);
  });
});
