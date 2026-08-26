import type { ZodTypeAny } from "zod";

export type AgentModelSelector = "mini" | "main";

export type AgentCost = Readonly<{
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputUsd: number;
  outputUsd: number;
  totalUsd: number;
}>;

export type StructuredAgentSuccess<TOutput> = Readonly<{
  output: TOutput;
  cost: AgentCost;
}>;

export type StructuredAgentInput<TSchema extends ZodTypeAny> = Readonly<{
  systemPrompt: string;
  prompt: string;
  schema: TSchema;
  model?: AgentModelSelector;
  tools?: AgentToolContents;
}>;

export type AgentToolContents = Readonly<{
  companyContextData: string;
  extractionData: string;
  adjesonData: string;
}>;

export type AgentEnv = Readonly<{
  pipelineKey: string;
  llmUrl: string;
  miniModel: string;
  mainModel: string;
  miniInputUsdPer1M: number;
  miniOutputUsdPer1M: number;
  mainInputUsdPer1M: number;
  mainOutputUsdPer1M: number;
}>;

export type StructuredAgentError = Readonly<{
  type:
    | "missing_env"
    | "invalid_env"
    | "invoke_failed"
    | "missing_usage_metadata"
    | "missing_structured_response"
    | "invalid_structured_response";
  message: string;
  key?: string;
  cause?: unknown;
}>;
