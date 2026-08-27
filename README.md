# edgarparse

## Prerequisites
I need this because of: https://github.com/piotrmaciejbednarski/text-similarity-node<br>
Before installing, ensure you have the necessary build tools installed on your system:

### Windows
Visual Studio 2017 or newer (with "Desktop development with C++" workload installed).
Python 3.x (required by node-gyp).
### macOS
Xcode Command Line Tools (xcode-select --install).
### Linux
GCC/G++ and Python 3.x.

## Database

- Prisma config: `prisma.config.ts`
- Schema: `DATABASE/prisma/schema.prisma`
- Migrations: `DATABASE/prisma/migrations`
- Database URL: `DATABASE_URL`

### Commands

- `bun run db:bootstrap`
- `bun run db:studio`
- `bun run db:reset-local`

### Notes

- The app does not bootstrap Prisma at runtime.
- `db:bootstrap` creates an empty local DB from migrations, then generates the client.
- `db:reset-local` deletes the local DB and all migrations.
- Tests create a temp SQLite DB, create a `PrismaClient`, then apply the migration SQL directly.
