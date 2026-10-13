import { z } from "zod";

const slug = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const queryValue = (schema) =>
  z.preprocess(
    (value) => (Array.isArray(value) ? value.at(-1) : value),
    schema,
  );

const positiveInteger = (defaultValue, maximum) =>
  queryValue(z.coerce.number().int().min(1).max(maximum).default(defaultValue));

const booleanQuery = queryValue(
  z
    .enum(["true", "false", "1", "0"])
    .transform((value) => value === "true" || value === "1")
    .optional(),
);

function commaSeparatedValues(itemSchema, maximum = 20) {
  return z.preprocess((value) => {
    if (value === undefined) {
      return [];
    }

    const values = Array.isArray(value) ? value : [value];

    return [
      ...new Set(
        values
          .flatMap((item) => String(item).split(","))
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    ];
  }, z.array(itemSchema).max(maximum));
}

const price = queryValue(
  z
    .string()
    .trim()
    .regex(/^\d{1,10}(?:\.\d{1,2})?$/)
    .optional(),
);

const audience = queryValue(
  z.enum(["women", "men", "kids", "accessories"]).optional(),
);

const sizeCode = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._/+\-]*$/);

const sort = queryValue(
  z
    .enum([
      "featured",
      "newest",
      "price_asc",
      "price_desc",
      "name_asc",
      "discount",
      "rating",
      "popular",
    ])
    .default("featured"),
);

const sharedFilterFields = {
  q: queryValue(z.string().trim().min(2).max(100).optional()),

  audience,

  category: queryValue(slug.optional()),

  brand: commaSeparatedValues(slug),

  color: commaSeparatedValues(
    z
      .string()
      .trim()
      .min(1)
      .max(50)
      .regex(/^[A-Za-z0-9_-]+$/),
  ),

  size: commaSeparatedValues(sizeCode, 50),

  fit: commaSeparatedValues(
    z
      .string()
      .trim()
      .min(1)
      .max(50)
      .regex(/^[A-Za-z0-9_-]+$/),
  ),

  minPrice: price,

  maxPrice: price,

  minDiscount: queryValue(z.coerce.number().int().min(1).max(100).optional()),

  featured: booleanQuery,

  inStock: booleanQuery,

  onSale: booleanQuery,

  tryOn: booleanQuery,

  lang: queryValue(z.enum(["it", "en"]).optional()),
};

function validatePriceRange(value, context) {
  if (
    value.minPrice !== undefined &&
    value.maxPrice !== undefined &&
    Number(value.minPrice) > Number(value.maxPrice)
  ) {
    context.addIssue({
      code: "custom",
      path: ["maxPrice"],
      message: "must_be_greater_than_or_equal_to_min_price",
    });
  }
}

export const catalogLanguageQuerySchema = z
  .object({
    lang: queryValue(z.enum(["it", "en"]).optional()),
  })
  .strict();

export const brandListQuerySchema = z
  .object({
    category: queryValue(slug.optional()),
    q: queryValue(z.string().trim().min(1).max(100).optional()),
    lang: queryValue(z.enum(["it", "en"]).optional()),
  })
  .strict();

export const catalogFiltersQuerySchema = z
  .object({
    ...sharedFilterFields,
    page: positiveInteger(1, 100000),
    limit: positiveInteger(20, 50),
    sort,
  })
  .strict()
  .superRefine(validatePriceRange);

export const productListQuerySchema = z
  .object({
    ...sharedFilterFields,
    page: positiveInteger(1, 100000),
    limit: positiveInteger(20, 50),
    sort,
  })
  .strict()
  .superRefine(validatePriceRange);

export const productSlugParamsSchema = z
  .object({
    slug,
  })
  .strict();

export const productReviewsQuerySchema = z
  .object({
    sort: queryValue(
      z.enum(["recent", "helpful", "rating_desc", "rating_asc"]).default("recent"),
    ),
    rating: commaSeparatedValues(z.coerce.number().int().min(1).max(5), 5),
    withPhotos: booleanQuery,
    size: queryValue(sizeCode.optional()),
    page: positiveInteger(1, 100000),
    limit: positiveInteger(10, 20),
    lang: queryValue(z.enum(["it", "en"]).optional()),
  })
  .strict();
