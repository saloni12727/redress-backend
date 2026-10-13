import { z } from "zod";

const identifier = z.coerce.number().int().positive().safe();
const code = z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/);
const slug = z.string().trim().min(1).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const money = z.coerce.number().nonnegative().finite().max(99_999_999.99);
const optionalMoney = z.preprocess((value) => value === "" || value === null ? null : value, money.nullable().optional());
const optionalId = z.preprocess((value) => value === "" || value === null ? null : value, identifier.nullable().optional());
const optionalString = (max) => z.preprocess((value) => value === "" || value === null ? null : value, z.string().trim().max(max).nullable().optional());
const optionalDate = z.preprocess((value) => value === "" || value === null ? null : value, z.coerce.date().nullable().optional());
const optionalBoolean = () => z.preprocess((value) => value === "true" ? true : value === "false" ? false : value, z.boolean().optional());

const translation = z.object({
  languageCode: z.enum(["en", "it"]),
  name: z.string().trim().min(1).max(255),
  shortDescription: optionalString(2000),
  description: optionalString(20000),
  careInstructions: optionalString(10000),
  sizeAndFitNotes: optionalString(10000),
  seoTitle: optionalString(255),
  seoDescription: optionalString(500),
}).strict();

const productFields = {
  code: code.optional(),
  slug: slug.optional(),
  brandId: optionalId,
  fitProfileId: optionalId,
  currencyCode: z.string().trim().regex(/^[A-Z]{3}$/).optional(),
  isReturnable: optionalBoolean(),
  translations: z.array(translation).min(1).max(2).optional(),
};

export const createProductSchema = z.object(productFields).strict().superRefine((value, context) => {
  for (const field of ["code", "slug", "currencyCode"]) {
    if (value[field] === undefined) context.addIssue({ code: "custom", path: [field], message: "required" });
  }
});

export const updateProductSchema = z.object(productFields).strict().refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const categoryMappingSchema = z.object({
  categories: z.array(z.object({
    categoryId: identifier,
    isPrimary: z.boolean().optional(),
    sortOrder: z.coerce.number().int().min(0).max(1_000_000).optional(),
  }).strict()).min(1).max(20),
}).strict().superRefine((value, context) => {
  const ids = value.categories.map((item) => item.categoryId);
  if (new Set(ids).size !== ids.length) context.addIssue({ code: "custom", path: ["categories"], message: "duplicate categories" });
  if (value.categories.filter((item) => item.isPrimary).length > 1) context.addIssue({ code: "custom", path: ["categories"], message: "one primary category" });
});

const variantFields = {
  sizeId: optionalId,
  colorId: optionalId,
  sku: z.string().trim().min(1).max(160).optional(),
  barcode: optionalString(80),
  regularPrice: money.optional(),
  salePrice: optionalMoney,
  costPrice: optionalMoney,
  saleStartAt: optionalDate,
  saleEndAt: optionalDate,
  weightValue: z.preprocess((value) => value === "" || value === null ? null : value, z.coerce.number().positive().finite().max(9_999_999.999).nullable().optional()),
  weightUnit: optionalString(10),
  isDefault: optionalBoolean(),
  isActive: optionalBoolean(),
  sortOrder: z.coerce.number().int().min(0).max(1_000_000).optional(),
};

function checkVariant(value, context, required) {
  if (required) {
    for (const field of ["sku", "regularPrice"]) if (value[field] === undefined) context.addIssue({ code: "custom", path: [field], message: "required" });
  }
  if (value.salePrice !== undefined && value.salePrice !== null && value.regularPrice !== undefined && value.salePrice > value.regularPrice) context.addIssue({ code: "custom", path: ["salePrice"], message: "must not exceed regular price" });
  if (value.saleStartAt && value.saleEndAt && value.saleEndAt <= value.saleStartAt) context.addIssue({ code: "custom", path: ["saleEndAt"], message: "must be later than sale start" });
}

export const createVariantSchema = z.object(variantFields).strict().superRefine((value, context) => checkVariant(value, context, true));
export const updateVariantSchema = z.object(variantFields).strict().refine((value) => Object.keys(value).length > 0, "At least one field is required").superRefine((value, context) => checkVariant(value, context, false));

export const inventorySchema = z.object({
  quantityOnHand: z.coerce.number().int().min(0).max(2_000_000_000).optional(),
  reorderPoint: z.coerce.number().int().min(0).max(2_000_000_000).optional(),
  safetyStock: z.coerce.number().int().min(0).max(2_000_000_000).optional(),
  allowBackorder: optionalBoolean(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field is required");

const measurement = z.object({
  measurementTypeId: identifier,
  valueCm: z.coerce.number().positive().finite().max(9_999_999.99),
  tolerancePlusCm: z.coerce.number().min(0).finite().max(9_999.99).optional(),
  toleranceMinusCm: z.coerce.number().min(0).finite().max(9_999.99).optional(),
  isEstimated: optionalBoolean(),
  notes: optionalString(500),
}).strict();

export const sizeChartSchema = z.object({
  measurements: z.array(measurement).min(1).max(100),
}).strict().superRefine((value, context) => {
  const ids = value.measurements.map((item) => item.measurementTypeId);
  if (new Set(ids).size !== ids.length) context.addIssue({ code: "custom", path: ["measurements"], message: "duplicate measurement types" });
});

const attributeInput = z.object({
  attributeId: identifier,
  optionValueIds: z.array(identifier).min(1).max(30).optional(),
  valueText: optionalString(10000),
  valueDecimal: z.preprocess((value) => value === "" || value === null ? null : value, z.coerce.number().finite().min(-9_999_999_999.999).max(9_999_999_999.999).nullable().optional()),
  valueBoolean: z.preprocess((value) => value === "true" ? true : value === "false" ? false : value, z.boolean().optional()),
  unitCode: optionalString(20),
}).strict();

export const productAttributesSchema = z.object({
  attributes: z.array(attributeInput).max(100),
}).strict().superRefine((value, context) => {
  const ids = value.attributes.map((item) => item.attributeId);
  if (new Set(ids).size !== ids.length) context.addIssue({ code: "custom", path: ["attributes"], message: "duplicate attributes" });
});

export const mediaPatchSchema = z.object({
  altText: optionalString(255),
  sortOrder: z.coerce.number().int().min(0).max(1_000_000).optional(),
  isPrimary: optionalBoolean(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field is required");

const queryValue = (schema) => z.preprocess((value) => Array.isArray(value) ? value.at(-1) : value, schema);
export const productIdSchema = z.object({ id: queryValue(identifier) });
export const variantIdSchema = z.object({ id: queryValue(identifier), variantId: queryValue(identifier) });
export const mediaIdSchema = z.object({ id: queryValue(identifier), mediaId: queryValue(identifier) });
export const listProductsQuerySchema = z.object({
  page: queryValue(z.coerce.number().int().min(1).max(100000).default(1)),
  limit: queryValue(z.coerce.number().int().min(1).max(100).default(20)),
  status: queryValue(z.enum(["draft", "published", "archived"]).optional()),
  approvalStatus: queryValue(z.enum(["draft", "pending", "approved", "rejected"]).optional()),
  q: queryValue(z.string().trim().min(1).max(120).optional()),
}).strict();
