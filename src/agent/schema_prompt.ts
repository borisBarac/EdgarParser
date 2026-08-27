import { z } from "zod";

const describeField = (name: string, schema: any): string =>
  `- ${name}${schema.safeParse(undefined).success ? " (optional)" : " (required)"}`;

const describeObjectFields = (schema: z.ZodObject<z.ZodRawShape>): string =>
  Object.entries(schema.shape)
    .map(([name, field]) => describeField(name, field))
    .join("\n");

export const describeSchemaFields = (schema: z.ZodTypeAny): string => {
  if (schema instanceof z.ZodArray) {
    return describeSchemaFields(schema.element as z.ZodTypeAny);
  }

  if (schema instanceof z.ZodObject) {
    return describeObjectFields(schema);
  }

  return `- ${schema.constructor.name}`;
};
