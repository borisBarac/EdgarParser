import { ChatOpenAI } from "@langchain/openai";
import { createAgent, modelRetryMiddleware, providerStrategy } from "langchain";
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
import { createAgentTools } from "./tools";
import type {
  AgentEnv,
  StructuredAgentError,
  StructuredAgentInput,
  StructuredAgentSuccess,
} from "./types";

type AgentTool = ReturnType<typeof createAgentTools>[number];

type AgentRetryConfig = Readonly<{
  maxRetries: number;
  initialDelayMs: number;
  backoffFactor: number;
  maxDelayMs: number;
  jitter: boolean;
  onFailure: "error";
}>;

const retryDefaults: AgentRetryConfig = {
  maxRetries: 5,
  initialDelayMs: 2_000,
  backoffFactor: 2,
  maxDelayMs: 30_000,
  jitter: true,
  onFailure: "error",
};

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
type RetryEnvKey =
  | "AGENT_RETRY_MAX_RETRIES"
  | "AGENT_RETRY_INITIAL_DELAY_MS"
  | "AGENT_RETRY_BACKOFF_FACTOR"
  | "AGENT_RETRY_MAX_DELAY_MS"
  | "AGENT_RETRY_JITTER"
  | "AGENT_RETRY_ON_FAILURE";

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
  message: "The agent run did not include accumulated cost state.",
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

  const pipelineKey = Bun.env.PIPELINE_KEY!;
  const llmUrl = Bun.env.LLM_URL!;
  const miniModel = Bun.env.MODEL_MINI!;
  const mainModel = Bun.env.MODEL_MAIN!;

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

const readRetryEnv = (): Result<AgentRetryConfig, StructuredAgentError> => {
  const readNumber = (
    key: RetryEnvKey,
    fallback: number,
  ): Result<number, StructuredAgentError> => {
    const raw = Bun.env[key];
    if (raw === undefined || raw.trim().length === 0) return ok(fallback);

    const parsed = Number(raw);
    return Number.isFinite(parsed)
      ? ok(parsed)
      : err(invalidEnvError(key, raw));
  };

  const readBoolean = (
    key: RetryEnvKey,
    fallback: boolean,
  ): Result<boolean, StructuredAgentError> => {
    const raw = Bun.env[key];
    if (raw === undefined || raw.trim().length === 0) return ok(fallback);

    if (raw === "true" || raw === "1") return ok(true);
    if (raw === "false" || raw === "0") return ok(false);
    return err(invalidEnvError(key, raw));
  };

  const readFailureMode = (
    key: RetryEnvKey,
    fallback: "error",
  ): Result<"error", StructuredAgentError> => {
    const raw = Bun.env[key];
    if (raw === undefined || raw.trim().length === 0) return ok(fallback);
    return raw === "error" ? ok("error") : err(invalidEnvError(key, raw));
  };

  const maxRetries = readNumber(
    "AGENT_RETRY_MAX_RETRIES",
    retryDefaults.maxRetries,
  );
  if (maxRetries.isErr()) return err(maxRetries.error);

  const initialDelayMs = readNumber(
    "AGENT_RETRY_INITIAL_DELAY_MS",
    retryDefaults.initialDelayMs,
  );
  if (initialDelayMs.isErr()) return err(initialDelayMs.error);

  const backoffFactor = readNumber(
    "AGENT_RETRY_BACKOFF_FACTOR",
    retryDefaults.backoffFactor,
  );
  if (backoffFactor.isErr()) return err(backoffFactor.error);

  const maxDelayMs = readNumber(
    "AGENT_RETRY_MAX_DELAY_MS",
    retryDefaults.maxDelayMs,
  );
  if (maxDelayMs.isErr()) return err(maxDelayMs.error);

  const jitter = readBoolean("AGENT_RETRY_JITTER", retryDefaults.jitter);
  if (jitter.isErr()) return err(jitter.error);

  const onFailure = readFailureMode(
    "AGENT_RETRY_ON_FAILURE",
    retryDefaults.onFailure,
  );
  if (onFailure.isErr()) return err(onFailure.error);

  return ok({
    maxRetries: maxRetries.value,
    initialDelayMs: initialDelayMs.value,
    backoffFactor: backoffFactor.value,
    maxDelayMs: maxDelayMs.value,
    jitter: jitter.value,
    onFailure: onFailure.value,
  });
};

const readCostTokens = (
  cost: unknown,
): Result<
  Readonly<{ inputTokens: number; outputTokens: number; totalTokens: number }>,
  StructuredAgentError
> => {
  if (
    typeof cost !== "object" ||
    cost === null ||
    !("inputTokens" in cost) ||
    !("outputTokens" in cost) ||
    !("totalTokens" in cost)
  ) {
    return err(missingUsageMetadataError());
  }

  const value = cost as Record<string, unknown>;
  const inputTokens = Number(value.inputTokens);
  const outputTokens = Number(value.outputTokens);
  const totalTokens = Number(value.totalTokens);

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
  retry: AgentRetryConfig,
  model: "mini" | "main",
  schema: ZodTypeAny,
  systemPrompt: string,
  tools: AgentTool[],
) =>
  createAgent({
    model: new ChatOpenAI({
      model: resolveModelName(env, model),
      apiKey: env.pipelineKey,
      configuration: {
        baseURL: env.llmUrl,
      },
    }),
    tools,
    responseFormat: providerStrategy(schema),
    systemPrompt,
    middleware: [
      createCostMiddleware(),
      modelRetryMiddleware({
        ...retry,
      }),
    ],
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

  const retryResult = readRetryEnv();
  if (retryResult.isErr()) {
    return errAsync(retryResult.error);
  }

  const env = envResult.value;
  const retry = retryResult.value;
  const tools = input.tools === undefined ? [] : createAgentTools(input.tools);
  const agent = buildAgent(
    env,
    retry,
    input.model ?? "mini",
    input.schema,
    input.systemPrompt,
    tools,
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

    const usage = readCostTokens(result);
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
