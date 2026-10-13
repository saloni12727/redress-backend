import { z } from "zod";

const queryValue = (schema) => z.preprocess((value) => Array.isArray(value) ? value.at(-1) : value, schema);
const identifier = z.coerce.number().int().positive().safe();
export const productIdSchema = z.object({ id: queryValue(identifier) });
export const submissionsQuerySchema = z.object({
  page: queryValue(z.coerce.number().int().min(1).max(100000).default(1)),
  limit: queryValue(z.coerce.number().int().min(1).max(100).default(20)),
  q: queryValue(z.string().trim().min(1).max(120).optional()),
}).strict();
export const rejectProductSchema = z.object({
  reason: z.string().trim().min(3).max(2000),
}).strict();
