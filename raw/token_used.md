## Tokens used Langchain example

```ts
import { createAgent, tool } from "langchain";
import { z } from "zod";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT_DIR = "/data/filings";

const listFiles = tool(
  async () => {
    const entries = await readdir(ROOT_DIR, {
      withFileTypes: true,
    });

    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name);
  },
  {
    name: "list_files",
    description: "List all files available in the filings folder.",
    schema: z.object({}),
  },
);

const readFileTool = tool(
  async ({ name }) => {
    // Prevent ../../etc/passwd style traversal
    const filePath = path.resolve(ROOT_DIR, name);
    const rootPath = path.resolve(ROOT_DIR);

    if (!filePath.startsWith(rootPath + path.sep)) {
      throw new Error("File must be inside the filings folder");
    }

    return await readFile(filePath, "utf-8");
  },
  {
    name: "read_file",
    description:
      "Read a file from the filings folder. Use list_files first if you don't know the exact filename.",
    schema: z.object({
      name: z.string().describe("Filename returned by list_files"),
    }),
  },
);

const agent = createAgent({
  model: "openai:gpt-5.4",
  tools: [listFiles, readFileTool],
});

const result = await agent.invoke({
  messages: [
    {
      role: "user",
      content:
        "Find the Apple filing in the folder, read it, and tell me the company name.",
    },
  ],
});

console.log(result);
```ts