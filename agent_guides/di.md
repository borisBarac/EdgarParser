# Functional Dependency Injection

In a functional TypeScript codebase, avoid classes and DI containers. Pass dependencies as plain typed objects and inject them through factory functions.

```ts
type Deps = {
  loadUser: (id: string) => Promise<User>;
  saveUser: (user: User) => Promise<void>;
  now: () => Date;
};

const createUpdateUser =
  (deps: Deps) =>
  async (id: string, name: string) => {
    const user = await deps.loadUser(id);

    const updated = {
      ...user,
      name,
      updatedAt: deps.now(),
    };

    await deps.saveUser(updated);
    return updated;
  };
```

Production wiring happens at the application boundary:

```ts
const updateUser = createUpdateUser({
  loadUser: db.loadUser,
  saveUser: db.saveUser,
  now: () => new Date(),
});
```

Tests inject simple fakes instead of mocking modules.

## With `neverthrow`

Side-effecting dependencies should return `Result` or `ResultAsync` instead of throwing.

```ts
type Deps = {
  users: {
    getById: (id: string) => ResultAsync<User, RepositoryError>;
    save: (user: User) => ResultAsync<void, RepositoryError>;
  };
  now: () => Date;
};

const createUpdateUser =
  ({ users, now }: Deps) =>
  (id: string, name: string) =>
    users.getById(id)
      .map(user => ({ ...user, name, updatedAt: now() }))
      .andThen(user => users.save(user).map(() => user));
```

## Rules

* No DI containers.
* Prefer functions over service classes.
* Dependencies are plain typed objects.
* Inject external effects: DB, HTTP, filesystem, LLM, clock, IDs.
* Keep pure transformations dependency-free.
* Return `Result` / `ResultAsync` instead of throwing.
* Define only the dependencies each workflow needs.
* Wire real implementations once in the composition root (`main.ts`).

```text
Pure functions
    ↓
Workflows
    ↓
Dependency interfaces
    ↓
DB / HTTP / FS / LLM implementations
    ↓
Composition root
```

This is functional dependency injection: dependencies are passed explicitly through arguments and closures, making workflows easy to test without module mocking.
