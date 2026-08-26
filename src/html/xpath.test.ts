import { describe, expect, test } from "bun:test";
import { getHtmlElementAtXPath, getTagXPaths } from "./xpath";

const html = `
<!doctype html>
<html>
  <body>
    <table id="top-1"></table>
    <div>
      <table id="nested-1"></table>
      <table id="nested-2"></table>
      <section>
        <table id="deep-1"></table>
      </section>
    </div>
    <table id="top-2"></table>
  </body>
</html>
`;

describe("xpath helpers", () => {
  test("getTagXPaths returns every table xpath", () => {
    const result = getTagXPaths(html, "table");

    const xpaths = result.match(
      (value) => value,
      (error) => {
        throw new Error(`unexpected error: ${JSON.stringify(error)}`);
      },
    );

    expect(xpaths).toEqual([
      '/*[local-name()="html"][1]/*[local-name()="body"][1]/*[local-name()="table"][1]',
      '/*[local-name()="html"][1]/*[local-name()="body"][1]/*[local-name()="div"][1]/*[local-name()="table"][1]',
      '/*[local-name()="html"][1]/*[local-name()="body"][1]/*[local-name()="div"][1]/*[local-name()="table"][2]',
      '/*[local-name()="html"][1]/*[local-name()="body"][1]/*[local-name()="div"][1]/*[local-name()="section"][1]/*[local-name()="table"][1]',
      '/*[local-name()="html"][1]/*[local-name()="body"][1]/*[local-name()="table"][2]',
    ]);
  });

  test("getHtmlElementAtXPath resolves table xpaths", () => {
    const xpaths = getTagXPaths(html, "table").match(
      (value) => value,
      (error) => {
        throw new Error(`unexpected error: ${JSON.stringify(error)}`);
      },
    );

    expect(xpaths).toHaveLength(5);

    const ids = ["top-1", "nested-1", "nested-2", "deep-1", "top-2"];

    for (const [index, xpath] of xpaths.entries()) {
      const element = getHtmlElementAtXPath(html, xpath).match(
        (value) => value,
        (error) => {
          throw new Error(`unexpected error: ${JSON.stringify(error)}`);
        },
      );

      expect(element).not.toBeNull();
      expect(element?.tagName.toLowerCase()).toBe("table");
      expect(element?.getAttribute("id")).toBe(ids[index]);
    }
  });

  test("getHtmlElementAtXPath returns null for missing nodes", () => {
    const result = getHtmlElementAtXPath(
      html,
      '/*[local-name()="html"][1]/*[local-name()="body"][1]/*[local-name()="table"][99]',
    );

    const value = result.match(
      (node) => node,
      (error) => {
        throw new Error(`unexpected error: ${JSON.stringify(error)}`);
      },
    );

    expect(value).toBeNull();
  });

  test("getTagXPaths round-trips mixed-case foreign content", () => {
    const svgHtml = `
<!doctype html>
<html>
  <body>
    <svg xmlns="http://www.w3.org/2000/svg">
      <foreignObject id="foreign-1"></foreignObject>
    </svg>
  </body>
</html>
`;

    const xpaths = getTagXPaths(svgHtml, "foreignObject").match(
      (value) => value,
      (error) => {
        throw new Error(`unexpected error: ${JSON.stringify(error)}`);
      },
    );

    expect(xpaths).toEqual([
      '/*[local-name()="html"][1]/*[local-name()="body"][1]/*[local-name()="svg"][1]/*[local-name()="foreignObject"][1]',
    ]);

    const xpath = xpaths[0];

    if (xpath === undefined) {
      throw new Error("expected one xpath");
    }

    const element = getHtmlElementAtXPath(svgHtml, xpath).match(
      (value) => value,
      (error) => {
        throw new Error(`unexpected error: ${JSON.stringify(error)}`);
      },
    );

    expect(element?.getAttribute("id")).toBe("foreign-1");
  });
});
