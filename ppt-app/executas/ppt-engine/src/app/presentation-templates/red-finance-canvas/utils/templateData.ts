import type * as z from "zod";

export const VALIDATE_TEMPLATE_DATA = false;

export function readTemplateData<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  data: unknown,
): z.infer<TSchema> {
  if (VALIDATE_TEMPLATE_DATA) {
    return schema.parse(data ?? {});
  }

  return (data ?? {}) as z.infer<TSchema>;
}
