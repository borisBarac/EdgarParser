# LLM API Access for Your Take-Home Test

You have been provided with an API key that gives you access to LLM models for this assignment. The key connects through a lightweight proxy (Portkey) that handles routing to the underlying providers. From your perspective, it works exactly like a standard OpenAI-compatible API.

## Your Credentials

| Item                 | Value                                                                          |
| -------------------- | ------------------------------------------------------------------------------ |
| **Coding-agent key** | Use this with your AI coding tool.                                             |
| **Pipeline key**     | Use this from your extraction service code.                                    |
| **Base URL**         | `https://api.portkey.ai/v1/`                                                   |
| **Available Models** | `gpt-5.4`, `gpt-5.4-mini` — either key can use either model. Pick per request. |
| **Budget**           | $100 USD (one cumulative hard cap, shared across both keys)                    |

The two keys are functionally identical. The split exists so we can separate coding-agent traffic from pipeline traffic in our logs -- please use them according to their labels.

## Quick Start

```bash
npm install openai
```

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: '<YOUR_PIPELINE_KEY>', // or the coding-agent key
  baseURL: 'https://api.portkey.ai/v1/',
});

const response = await client.chat.completions.create({
  model: 'gpt-5.4-mini', // or "gpt-5.4"
  messages: [{ role: 'user', content: 'Hello!' }],
});
console.log(response.choices[0].message.content);
```

### cURL

```bash
curl https://api.portkey.ai/v1/chat/completions \
  -H "Authorization: Bearer <YOUR_PIPELINE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-5.4-mini",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

### OpenCode

You don't need to use OpenCode, however you can use this `opencode.json` as an example.

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "portkey": {
      "npm": "@ai-sdk/openai",
      "name": "Portkey (stockstory – coding-agent key)",
      "options": {
        "baseURL": "https://api.portkey.ai/v1",
        "headers": {
          "x-portkey-api-key": "<YOUR_CODING_AGENT_KEY>"
        }
      },
      "models": {
        "gpt-5.4": { "name": "gpt-5.4" },
        "gpt-5.4-mini": { "name": "gpt-5.4-mini" }
      }
    }
  }
}
```

## What You Need to Know

- **It's OpenAI-compatible.** Any library or tool that supports the OpenAI API format will work. Just set the base URL to `https://api.portkey.ai/v1/` and use your provided key.
- **Two keys, both chat models available.** Either key can call either of `gpt-5.4` or `gpt-5.4-mini` via `/v1/chat/completions`. Pick the model per request based on the task; we use the key label to separate coding-agent traffic from pipeline traffic in our logs.
- **You have a $100 budget**, shared across both keys, cumulative (no auto-reset). If you exhaust it, requests will return a `402` error. Plan your usage accordingly.
- **Retries are built in.** Transient errors (rate limits, server errors) are automatically retried twice, so you don't need to implement retry logic for the API connection itself.

## Troubleshooting

| Error           | Meaning          | What to Do                                                                         |
| --------------- | ---------------- | ---------------------------------------------------------------------------------- |
| `402`           | Budget exhausted | You've used your $100 allowance. Contact us if you believe this is an error.       |
| `429`           | Rate limit       | Temporary; wait a moment and retry. The proxy handles most of these automatically. |
| `401`           | Invalid key      | Double-check your API key and that `Authorization: Bearer <key>` is set correctly. |
| Model not found | Wrong model name | Use exactly `gpt-5.4` or `gpt-5.4-mini`.                                           |
