import { describe, expect, it } from "bun:test";

import { createAgentTools } from "./tools";

describe("agent tools", () => {
  it("creates configured zero-arg tools", async () => {
    const tools = createAgentTools({
      extractionData: "extraction text",
      adjesonData: "adjeson text",
    });

    expect(tools.map((tool) => tool.name)).toEqual([
      "getExtractionData",
      "GetAdjesonData",
    ]);

    // biome-ignore lint/style/noNonNullAssertion: array is asserted by test input
    const extractionTool = tools[0]!;
    // biome-ignore lint/style/noNonNullAssertion: array is asserted by test input
    const adjesonTool = tools[1]!;

    expect(extractionTool.description).toContain("Use this first");
    expect(adjesonTool.description).toContain("Fallback");

    await expect(extractionTool.invoke({})).resolves.toBe("extraction text");
    await expect(adjesonTool.invoke({})).resolves.toBe("adjeson text");
  });
});
