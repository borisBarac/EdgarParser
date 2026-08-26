# E2E Tests

Run e2e tests with:

```sh
bun run test:e2e
```

Live LLM tests are gated behind `--liveLLM` in the test file, but Bun test does not reliably forward custom args.
Use `LIVE_LLM=1` when running them.

Examples:

```sh
LIVE_LLM=1 bun test e2e/agent.index.live.test.ts
```

The flag is not hardcoded in package scripts, so normal e2e runs stay offline-safe.
