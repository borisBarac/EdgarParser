import { encoding_for_model } from "tiktoken";

type TokenModel = Parameters<typeof encoding_for_model>[0];

// this is library enum, so not 5.4, but size should be similar if it is not the same
const defaultModel: TokenModel = "gpt-5-mini-2025-08-07";

export const estimateStringTokens = (
  text: string,
  model: TokenModel = defaultModel,
): number => {
  const encoding = encoding_for_model(model);

  try {
    return encoding.encode(text).length;
  } finally {
    encoding.free();
  }
};

export default estimateStringTokens;
