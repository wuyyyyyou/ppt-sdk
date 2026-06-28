import type * as z from "zod";

export function readTemplateData<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  data: unknown,
): z.infer<TSchema> {
  return schema.parse(data ?? {});
}
