import { tool } from "@langchain/core/tools";
import { z } from "zod";

import type { AgentToolContents } from "./types";

const zeroArgSchema = z.object({}).strict();

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
    "GetCompanyContextData",
    "Returns company context data configured when the agent is created.",
    toolContents.companyContextData,
  ),
  createConfiguredTool(
    "getExtractionData",
    "Returns extraction data configured when the agent is created.",
    toolContents.extractionData,
  ),
  createConfiguredTool(
    "GetAdjesonData",
    "Returns Adjeson data configured when the agent is created.",
    toolContents.adjesonData,
  ),
];
