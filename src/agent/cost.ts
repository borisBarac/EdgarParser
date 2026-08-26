import { createMiddleware } from "langchain";
import { z } from "zod";

import type { AgentCost, AgentEnv, AgentModelSelector } from "./types";

const costStateSchema = z.object({
  inputTokens: z.number().int().nonnegative().default(0),
  outputTokens: z.number().int().nonnegative().default(0),
  totalTokens: z.number().int().nonnegative().default(0),
});

export const createCostMiddleware = () =>
  createMiddleware({
    name: "CostMiddleware",
    stateSchema: costStateSchema,
    afterModel: (state) => {
      const response = state.messages.at(-1) as
        | { usage_metadata?: unknown }
        | undefined;
      const usage = response?.usage_metadata as
        | {
            input_tokens?: number;
            output_tokens?: number;
            total_tokens?: number;
          }
        | undefined;

      if (!usage) return state;

      const { input_tokens, output_tokens, total_tokens } = usage;
      if (
        input_tokens === undefined ||
        output_tokens === undefined ||
        total_tokens === undefined
      ) {
        return state;
      }

      if (![input_tokens, output_tokens, total_tokens].every(Number.isFinite))
        return state;

      return {
        inputTokens: state.inputTokens + input_tokens,
        outputTokens: state.outputTokens + output_tokens,
        totalTokens: state.totalTokens + total_tokens,
      };
    },
  });

export const resolveModelName = (
  env: Pick<AgentEnv, "miniModel" | "mainModel">,
  model: AgentModelSelector,
): string => (model === "main" ? env.mainModel : env.miniModel);

export const calculateCost = (
  tokens: Readonly<{
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  }>,
  rates: Readonly<{
    inputUsdPer1M: number;
    outputUsdPer1M: number;
  }>,
): AgentCost => {
  const inputUsd = (tokens.inputTokens / 1_000_000) * rates.inputUsdPer1M;
  const outputUsd = (tokens.outputTokens / 1_000_000) * rates.outputUsdPer1M;

  return {
    inputTokens: tokens.inputTokens,
    outputTokens: tokens.outputTokens,
    totalTokens: tokens.totalTokens,
    inputUsd,
    outputUsd,
    totalUsd: inputUsd + outputUsd,
  };
};
