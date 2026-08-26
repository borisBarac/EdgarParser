# Bun Unit Test Mocking

Use Bun's native test API:

```ts
import { afterEach, expect, mock, spyOn, test, vi } from "bun:test";
```

## Rules

* Prefer dependency injection over module mocking.
* Use `mock()` for injected dependencies and new Bun-native tests.
* Use `spyOn()` to observe or temporarily replace existing methods.
* Use `mock.module()` only when dependency injection is impractical.
* Mock external effects, not pure domain logic.
* Never call real network, database, filesystem, LLM, SDK, clock, random, or other external dependencies in unit tests.
* Keep mocks minimal, local, type-safe, and focused on observable behavior.
* Keep test files consistent with the mocking style already used.

## Function Mocks

```ts
const loadUser = mock(async (id: string) => ({
  id,
  name: "John",
}));

expect(loadUser).toHaveBeenCalledWith("123");
expect(loadUser).toHaveBeenCalledTimes(1);
```

Prefer built-in helpers:

```ts
fn.mockReturnValue(value);
fn.mockReturnValueOnce(value);

fn.mockResolvedValue(value);
fn.mockResolvedValueOnce(value);

fn.mockRejectedValue(error);
fn.mockRejectedValueOnce(error);
```

Use `*Once` methods for sequential behavior instead of adding counters or unnecessary logic inside mocks.

## Functional Code / neverthrow

Prefer explicit effect dependencies:

```ts
type Dependencies = {
  loadDocument: (
    id: string,
  ) => Promise<Result<Document, LoadError>>;
};
```

Mock them directly:

```ts
const deps: Dependencies = {
  loadDocument: mock(async () => ok(document)),
};
```

If production code returns `Result` / `ResultAsync`, mocks should normally return `Ok` / `Err`, not throw exceptions.

```ts
loadDocument: mock(async () => err(loadError));
```

## Spies

```ts
const spy = spyOn(service, "save");

await workflow(input);

expect(spy).toHaveBeenCalledWith(expected);
```

Override when needed:

```ts
spyOn(service, "load").mockResolvedValue(user);
```

Prefer injected `mock()` dependencies when you control dependency construction.

## Module Mocks

```ts
mock.module("./api-client", () => ({
  fetchUser: mock(async () => user),
}));
```

Bun module mocks work with ESM imports and CommonJS `require`.

A module may be mocked after it was imported, but its original import-time code has already executed.

If the real module must never execute, register the mock in a preload:

```toml
[test]
preload = ["./test/preload.ts"]
```

```ts
import { mock } from "bun:test";

mock.module("./external-client", () => ({
  send: mock(async () => result),
}));
```

Use preloads when imports may initialize SDKs, open connections, access environment state, perform filesystem work, or cause other side effects.

## Vitest Compatibility

Bun supports common Vitest-style mocking through `vi`:

```ts
import { vi } from "bun:test";

const fn = vi.fn();
```

Common compatible APIs include:

```ts
vi.fn()
vi.spyOn()
vi.mock()
vi.clearAllMocks()
vi.resetAllMocks()
vi.restoreAllMocks()
```

Existing Vitest-style tests can therefore often run under Bun without rewriting mocks.

For new Bun-native tests prefer:

```ts
const fn = mock();
```

Existing code may keep:

```ts
const fn = vi.fn();
```

Do not rewrite working `vi.fn()`, `vi.spyOn()`, or `vi.mock()` calls without a concrete reason.

Vitest-style module mocking is also supported:

```ts
vi.mock("./api", () => ({
  fetchData: vi.fn(),
}));
```

For new Bun-native code:

```ts
mock.module("./api", () => ({
  fetchData: mock(),
}));
```

Bun provides compatibility with common Vitest mocking APIs; do not assume every Vitest feature is fully compatible.

## Cleanup

Do not leak mock state between tests.

Bun-native:

```ts
afterEach(() => {
  mock.restore();
  mock.clearAllMocks();
});
```

Vitest-style:

```ts
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
```

Meaning:

```text
clear   → clear call history
reset   → clear history + mock implementation
restore → restore original implementation
```

`mock.restore()` does not undo module replacements created with `mock.module()`.

## What to Mock

Good boundaries:

```text
HTTP clients
database repositories
filesystem
clock/time
UUID/random
message queues
external SDKs
LLM providers
```

Usually test directly:

```text
pure transformations
validators
parsers
domain calculations
small pure helpers
```

## Test Structure

Use Arrange → Act → Assert.

```ts
test("returns the user", async () => {
  // Arrange
  const repository = {
    findById: mock(async () => ok(user)),
  };

  const service = createUserService(repository);

  // Act
  const result = await service.getUser("123");

  // Assert
  expect(result.isOk()).toBe(true);
  expect(repository.findById).toHaveBeenCalledWith("123");
});
```

## Agent Guidance

When writing tests:

1. Use `bun:test`.
2. Prefer dependency injection + `mock()`.
3. Preserve existing Vitest-compatible `vi.*` tests.
4. Mock effects, not pure logic.
5. Prefer built-in return/resolution helpers and `*Once` variants.
6. Use `spyOn()` for existing methods.
7. Use module mocks only when injection is impractical.
8. Use preload mocks when the original module must not execute.
9. Clean up mock state between tests.
10. Return `Ok` / `Err` for `neverthrow` contracts instead of throwing.
11. Never perform real external side effects in unit tests.
12. Test behavior and contracts, not implementation details.
