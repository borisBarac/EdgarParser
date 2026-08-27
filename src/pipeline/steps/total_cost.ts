import type { PipelineExtractionModel, PipelineModel } from "../model";

const zeroCost = {
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  inputUsd: 0,
  outputUsd: 0,
  totalUsd: 0,
} as const;

const addCosts = (
  left: Readonly<typeof zeroCost>,
  right: Readonly<typeof zeroCost>,
) => ({
  inputTokens: left.inputTokens + right.inputTokens,
  outputTokens: left.outputTokens + right.outputTokens,
  totalTokens: left.totalTokens + right.totalTokens,
  inputUsd: left.inputUsd + right.inputUsd,
  outputUsd: left.outputUsd + right.outputUsd,
  totalUsd: left.totalUsd + right.totalUsd,
});

export const calculateTotalCost = (
  model: PipelineExtractionModel,
): PipelineModel["totalCost"] =>
  [...model.quotes, ...model.tables].reduce(
    (total, item) => addCosts(total, item.cost),
    zeroCost,
  );

export const addTotalCost = (
  model: PipelineExtractionModel,
): PipelineModel => ({
  ...model,
  totalCost: calculateTotalCost(model),
});
