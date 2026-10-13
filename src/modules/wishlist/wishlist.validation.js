import { z } from "zod";

const id = z.coerce.number().int().positive().safe();

const queryValue = (schema) =>
  z.preprocess(
    (value) => (Array.isArray(value) ? value.at(-1) : value),
    schema,
  );

export const wishlistProductParamsSchema = z
  .object({ productId: id })
  .strict();

export const listWishlistQuerySchema = z
  .object({
    page: queryValue(
      z.coerce.number().int().min(1).max(100000).default(1),
    ),
    limit: queryValue(z.coerce.number().int().min(1).max(50).default(20)),
    lang: queryValue(z.enum(["it", "en"]).optional()),
  })
  .strict();
