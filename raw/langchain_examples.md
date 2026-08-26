

## Structured output example
```ts
import { createAgent, providerStrategy } from "langchain";
import { z } from "zod";

const ExtractionSchema = z.object({
  chunks: z.array(
    z.object({ OBECT SCHEMA  }),
  ),
  tables: z.array(
    z.object({ OBECT SCHEMA  }),
  ),
});

const html = `some HTML text`;

const agent = createAgent({
  model: "openai:gpt-5.4-mini",
  tools: [],
  responseFormat: providerStrategy(ExtractionSchema),
});

const result = await agent.invoke({
  messages: [
    {
      role: "user",
      content: `Extract narrative chunks and tables from this HTML.
Tables are chunk boundaries. Return absolute XPaths. Preserve document order.

${html}`,
    },
  ],
});

console.dir(result.structuredResponse, { depth: null });
```


## Cost middleware example
```ts
export function createCostMiddleware() {
  return createMiddleware({
    name: "CostMiddleware",
    stateSchema: z.object({
      inputTokens: z.number().int().nonnegative().default(0),
      outputTokens: z.number().int().nonnegative().default(0),
      totalTokens: z.number().int().nonnegative().default(0),
    }),
    afterModel: (state) => {
      const response = getFinalMessage(state.messages);
      const usage = response.usage_metadata;
      if (!usage) {
        throw new Error("The model response did not include usage_metadata. Cost cannot be calculated.");
      }
      const { input_tokens, output_tokens, total_tokens } = usage;
      if (![input_tokens, output_tokens, total_tokens].every(Number.isFinite)) {
        throw new Error("The model response has incomplete usage_metadata. Cost cannot be calculated.");
      }
      return {
        inputTokens: state.inputTokens + input_tokens,
        outputTokens: state.outputTokens + output_tokens,
        totalTokens: state.totalTokens + total_tokens,
      };
    },
  });
}
```