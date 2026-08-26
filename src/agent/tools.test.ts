import { describe, expect, it } from "bun:test";

import { createAgentTools } from "./tools";

describe("agent tools", () => {
  it("creates configured zero-arg tools", async () => {
    const tools = createAgentTools({
      companyContextData: "company text",
      extractionData: "extraction text",
      adjesonData: "adjeson text",
    });

    expect(tools.map((tool) => tool.name)).toEqual([
      "GetCompanyContextData",
      "getExtractionData",
      "GetAdjesonData",
    ]);

    const companyTool = tools[0]!;
    const extractionTool = tools[1]!;
    const adjesonTool = tools[2]!;

    await expect(companyTool.invoke({})).resolves.toBe("company text");
    await expect(extractionTool.invoke({})).resolves.toBe("extraction text");
    await expect(adjesonTool.invoke({})).resolves.toBe("adjeson text");
  });
});
