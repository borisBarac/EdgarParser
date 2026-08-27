import { afterAll, describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { cleanHtml, cleanHtmlFile } from "./clean";

const tempRoot = resolve(
  "/var/folders/xp/2fyz9z3j7mgfzfkdtpcn95kr0000gn/T/opencode",
  `html-clean-${crypto.randomUUID()}`,
);

const fixturePath = resolve(
  import.meta.dir,
  "../../edgar_files/TSM_2024_Q2.html",
);

const countTag = (html: string, tag: string): number =>
  (html.match(new RegExp(`<${tag}\\b`, "gi")) ?? []).length;

afterAll(async () => {
  await rm(tempRoot, { recursive: true, force: true });
});

describe("html cleaner", () => {
  test("cleanHtml removes banned tags, styles, and empty wrappers", async () => {
    const html = [
      "<document><type>X</type><sequence>1</sequence><filename>test.html</filename><description>Example<text>",
      '<div style="color:red"><script>bad()</script><style>.x{}</style><picture><source srcset="a" /><img src="a" /></picture><svg><path /></svg><div></div><span style="font-weight:bold">Keep me</span></div>',
      '<table><tbody><tr><td style="color:blue">Cell</td></tr></tbody></table>',
      "</text></description></filename></sequence></type></document>",
    ].join("");

    const result = await cleanHtml(html).match(
      (value) => value,
      (error) => {
        throw new Error(`unexpected error: ${JSON.stringify(error)}`);
      },
    );

    expect(result).toContain("<document>");
    expect(result).toContain("<text>");
    expect(result).toContain("Keep me");
    expect(result).toContain("Cell");
    expect(result).not.toMatch(
      /<script\b|<style\b|<img\b|<svg\b|<picture\b|<source\b/i,
    );
    expect(result).not.toMatch(/style=/i);
    expect(result).not.toContain("<div></div>");
  });

  test("cleanHtmlFile writes a sibling cleaned file", async () => {
    await mkdir(tempRoot, { recursive: true });

    const originalHtml = await Bun.file(fixturePath).text();
    const originalFilePath = join(tempRoot, "TSM_2024_Q2.html");

    await Bun.write(originalFilePath, originalHtml);

    const result = await cleanHtmlFile(originalFilePath).match(
      (value) => value,
      (error) => {
        throw new Error(`unexpected error: ${JSON.stringify(error)}`);
      },
    );

    expect(result.originalFilePath).toBe(originalFilePath);
    expect(result.cleanedFilePath).toBe(
      join(tempRoot, "TSM_2024_Q2_cleaned.html"),
    );

    const cleanedHtml = await Bun.file(result.cleanedFilePath).text();

    expect(cleanedHtml).toContain(
      "Taiwan Semiconductor Manufacturing Company Limited and Subsidiaries",
    );
    expect(cleanedHtml).not.toMatch(
      /<script\b|<style\b|<img\b|<svg\b|<picture\b|<source\b/i,
    );
    expect(cleanedHtml).not.toMatch(/style=/i);
    expect(countTag(cleanedHtml, "table")).toBe(
      countTag(originalHtml, "table"),
    );
    expect(countTag(cleanedHtml, "tr")).toBe(countTag(originalHtml, "tr"));
    expect(countTag(cleanedHtml, "td")).toBe(countTag(originalHtml, "td"));
    expect(countTag(cleanedHtml, "th")).toBe(countTag(originalHtml, "th"));
  });
});
