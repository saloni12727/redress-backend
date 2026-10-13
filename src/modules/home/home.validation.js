import { z } from "zod";

const queryValue = (schema) =>
  z.preprocess(
    (value) => (Array.isArray(value) ? value.at(-1) : value),
    schema,
  );

export const homeFeedQuerySchema = z
  .object({
    lang: queryValue(z.enum(["it", "en"]).optional()),
  })
  .strict();
