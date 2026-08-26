import "dotenv/config";

import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "DATABASE/prisma/schema.prisma",
  migrations: {
    path: "DATABASE/prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
