import { ChatOpenAI } from "@langchain/openai";
import { createAgent, providerStrategy } from "langchain";
import {
  err,
  errAsync,
  ok,
  okAsync,
  type Result,
  ResultAsync,
} from "neverthrow";
import type { ZodTypeAny, z } from "zod";

import { calculateCost, createCostMiddleware, resolveModelName } from "./cost";
import type {
  AgentEnv,
  StructuredAgentError,
  StructuredAgentInput,
  StructuredAgentSuccess,
} from "./types";

const requiredEnvKeys = [
  "PIPELINE_KEY",
  "LLM_URL",
  "MODEL_MINI",
  "MODEL_MAIN",
  "MODEL_MINI_IN_COST_USD",
  "MODEL_MINI_OUT_COST_USD",
  "MODEL_MAIN_IN_COST_USD",
  "MODEL_MAIN_OUT_COST_USD",
] as const;

type RequiredEnvKey = (typeof requiredEnvKeys)[number];

const missingEnvError = (key: string): StructuredAgentError => ({
  type: "missing_env",
  key,
  message: `Missing required env var: ${key}`,
});

const invalidEnvError = (
  key: string,
  cause: unknown,
): StructuredAgentError => ({
  type: "invalid_env",
  key,
  message: `Invalid env var: ${key}`,
  cause,
});

const invokeFailedError = (cause: unknown): StructuredAgentError => ({
  type: "invoke_failed",
  message: "LangChain agent invocation failed.",
  cause,
});

const missingUsageMetadataError = (): StructuredAgentError => ({
  type: "missing_usage_metadata",
  message: "The agent response did not include usage metadata.",
});

const missingStructuredResponseError = (): StructuredAgentError => ({
  type: "missing_structured_response",
  message: "The agent response did not include structured output.",
});

const invalidStructuredResponseError = (
  cause: unknown,
): StructuredAgentError => ({
  type: "invalid_structured_response",
  message: "The agent structured response did not match the provided schema.",
  cause,
});

const readRequiredEnv = (): Result<AgentEnv, StructuredAgentError> => {
  for (const key of requiredEnvKeys) {
    if (Bun.env[key] === undefined || Bun.env[key]?.trim().length === 0) {
      return err(missingEnvError(key));
    }
  }

  const pipelineKey = Bun.env.PIPELINE_KEY;
  const llmUrl = Bun.env.LLM_URL;
  const miniModel = Bun.env.MODEL_MINI;
  const mainModel = Bun.env.MODEL_MAIN;

  if (
    pipelineKey === undefined ||
    llmUrl === undefined ||
    miniModel === undefined ||
    mainModel === undefined
  ) {
    return err(missingEnvError("PIPELINE_KEY"));
  }

  const parseNumber = (
    key: RequiredEnvKey,
  ): Result<number, StructuredAgentError> => {
    const parsed = Number(Bun.env[key]);
    return Number.isFinite(parsed)
      ? ok(parsed)
      : err(invalidEnvError(key, Bun.env[key]));
  };

  const miniIn = parseNumber("MODEL_MINI_IN_COST_USD");
  if (miniIn.isErr()) return err(miniIn.error);

  const miniOut = parseNumber("MODEL_MINI_OUT_COST_USD");
  if (miniOut.isErr()) return err(miniOut.error);

  const mainIn = parseNumber("MODEL_MAIN_IN_COST_USD");
  if (mainIn.isErr()) return err(mainIn.error);

  const mainOut = parseNumber("MODEL_MAIN_OUT_COST_USD");
  if (mainOut.isErr()) return err(mainOut.error);

  return ok({
    pipelineKey,
    llmUrl,
    miniModel,
    mainModel,
    miniInputUsdPer1M: miniIn.value,
    miniOutputUsdPer1M: miniOut.value,
    mainInputUsdPer1M: mainIn.value,
    mainOutputUsdPer1M: mainOut.value,
  });
};

const readUsageTokens = (
  usage: unknown,
): Result<
  Readonly<{ inputTokens: number; outputTokens: number; totalTokens: number }>,
  StructuredAgentError
> => {
  if (
    typeof usage !== "object" ||
    usage === null ||
    !("input_tokens" in usage) ||
    !("output_tokens" in usage) ||
    !("total_tokens" in usage)
  ) {
    return err(missingUsageMetadataError());
  }

  const value = usage as Record<string, unknown>;
  const inputTokens = Number(value.input_tokens);
  const outputTokens = Number(value.output_tokens);
  const totalTokens = Number(value.total_tokens);

  if (![inputTokens, outputTokens, totalTokens].every(Number.isFinite)) {
    return err(missingUsageMetadataError());
  }

  return ok({ inputTokens, outputTokens, totalTokens });
};

const readStructuredResponse = <TSchema extends ZodTypeAny>(
  schema: TSchema,
  value: unknown,
): Result<z.infer<TSchema>, StructuredAgentError> => {
  if (value === undefined) {
    return err(missingStructuredResponseError());
  }

  const parsed = schema.safeParse(value);
  return parsed.success
    ? ok(parsed.data)
    : err(invalidStructuredResponseError(parsed.error));
};

const buildAgent = (
  env: AgentEnv,
  model: "mini" | "main",
  schema: ZodTypeAny,
  systemPrompt: string,
) =>
  createAgent({
    model: new ChatOpenAI({
      model: resolveModelName(env, model),
      apiKey: env.pipelineKey,
      configuration: {
        baseURL: env.llmUrl,
      },
    }),
    tools: [],
    responseFormat: providerStrategy(schema),
    systemPrompt,
    middleware: [createCostMiddleware()],
  });

export const runStructuredAgent = <TSchema extends ZodTypeAny>(
  input: StructuredAgentInput<TSchema>,
): ResultAsync<
  StructuredAgentSuccess<z.infer<TSchema>>,
  StructuredAgentError
> => {
  const envResult = readRequiredEnv();
  if (envResult.isErr()) {
    return errAsync(envResult.error);
  }

  const env = envResult.value;
  const agent = buildAgent(
    env,
    input.model ?? "mini",
    input.schema,
    input.systemPrompt,
  );

  return ResultAsync.fromPromise(
    agent.invoke({
      messages: [
        {
          role: "user",
          content: input.prompt,
        },
      ],
    }),
    invokeFailedError,
  ).andThen((result) => {
    const structuredResponse = readStructuredResponse(
      input.schema,
      result.structuredResponse,
    );
    if (structuredResponse.isErr()) {
      return errAsync(structuredResponse.error);
    }

    const finalMessage = result.messages.at(-1) as
      | { usage_metadata?: unknown }
      | undefined;
    const usage = readUsageTokens(finalMessage?.usage_metadata);
    if (usage.isErr()) {
      return errAsync(usage.error);
    }

    const rates =
      input.model === "main"
        ? {
            inputUsdPer1M: env.mainInputUsdPer1M,
            outputUsdPer1M: env.mainOutputUsdPer1M,
          }
        : {
            inputUsdPer1M: env.miniInputUsdPer1M,
            outputUsdPer1M: env.miniOutputUsdPer1M,
          };

    return okAsync({
      output: structuredResponse.value,
      cost: calculateCost(usage.value, rates),
    });
  });
};

export const createStructuredAgentStep = <TSchema extends ZodTypeAny>(
  input: StructuredAgentInput<TSchema>,
) => runStructuredAgent(input);

export { calculateCost, createCostMiddleware, resolveModelName } from "./cost";
export type {
  AgentCost,
  AgentEnv,
  AgentModelSelector,
  StructuredAgentError,
  StructuredAgentInput,
  StructuredAgentSuccess,
} from "./types";
