# Functional TypeScript

Use functional programming for all TypeScript code.

## Core rules

* Prefer pure functions and immutable data.
* Prefer composition over classes and mutable state.
* Keep functions small and focused.
* Keep side effects at system boundaries.
* Model application errors explicitly.

## Error handling

Use `neverthrow` for every fallible operation.

* Return `Result<T, E>` for synchronous operations.
* Return `ResultAsync<T, E>` for asynchronous operations.
* Do not throw application exceptions.
* Do not use `try/catch` for normal control flow.
* Convert exceptions from external libraries into typed `Result` errors at the boundary.
* Prefer `map`, `andThen`, `mapErr`, and `match` for composition.

## Pipeline design

Structure processing as composable stages:

`input -> validate -> transform -> process -> validate -> output`

Each stage should accept explicit input and return a `Result` or `ResultAsync`.

Prefer:

```ts
step1(input)
  .andThen(step2)
  .andThen(step3)
  .map(toOutput);
```

over imperative pipelines with mutable intermediate state.

## Design preferences

Prefer:

* discriminated unions
* readonly data
* dependency injection through function arguments
* functions returning functions when configuring dependencies
* explicit domain types
* typed error unions
* deterministic transformations

Avoid:

* hidden global state
* mutable shared state
* exception-driven control flow
* deeply nested `if` statements
* service classes used only as namespaces
* functions that mix I/O with domain transformations

When generating or modifying code, preserve this style unless an external API requires otherwise.
