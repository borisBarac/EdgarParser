import { tool } from "@langchain/core/tools";
import { z } from "zod";

import type { AgentToolContents } from "./types";

const zeroArgSchema = z.object({}).strict();

export const agentToolMetadata = {
  extractionData: {
    name: "getExtractionData",
    description:
      "Primary extraction data. Use this first. It is the main source for the filing content being extracted.",
  },
  adjesonData: {
    name: "GetAdjesonData",
    description:
      "Fallback adjacent-context data. Use only when getExtractionData does not contain the needed information.",
  },
} as const;

const createConfiguredTool = (
  name: string,
  description: string,
  text: string,
) =>
  tool(async () => text, {
    name,
    description,
    schema: zeroArgSchema,
  });

export const createAgentTools = (toolContents: AgentToolContents) => [
  createConfiguredTool(
    agentToolMetadata.extractionData.name,
    agentToolMetadata.extractionData.description,
    toolContents.extractionData,
  ),
  createConfiguredTool(
    agentToolMetadata.adjesonData.name,
    agentToolMetadata.adjesonData.description,
    toolContents.adjesonData,
  ),
];
