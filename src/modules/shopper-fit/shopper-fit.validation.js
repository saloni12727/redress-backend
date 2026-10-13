import { z } from "zod";

const identifier = z.coerce.number().int().positive().safe();
const finiteNumber = z.coerce.number().finite();
const nullableMeasurement = finiteNumber.nullable().optional();
const profileName = z.string().trim().min(2).max(40);
const photoUrl = z.string().trim().url().max(2048);

const measurementsSchema = z
  .object({
    heightCm: nullableMeasurement,
    weightKg: nullableMeasurement,
    shouldersCm: nullableMeasurement,
    chestCm: nullableMeasurement,
    waistCm: nullableMeasurement,
    hipsCm: nullableMeasurement,
    inseamCm: nullableMeasurement,
    armLengthCm: nullableMeasurement,
    shoeEu: nullableMeasurement,
    footLengthCm: nullableMeasurement,
  })
  .strict();

const photosSchema = z
  .object({
    front: photoUrl.nullable().optional(),
    back: photoUrl.nullable().optional(),
    left: photoUrl.nullable().optional(),
    right: photoUrl.nullable().optional(),
  })
  .strict();

const createFields = {
  name: profileName,
  relation: z.enum(["self", "partner", "child", "other"]),
  sex: z.enum(["male", "female"]).nullable().optional(),
  isDefault: z.boolean().optional(),
  measurements: measurementsSchema,
  stylist: z.record(z.string(), z.unknown()).nullable().optional(),
};

export const createBodyProfileSchema = z.object(createFields).strict();

export const updateBodyProfileSchema = z
  .object({
    name: profileName.optional(),
    relation: z.enum(["self", "partner", "child", "other"]).optional(),
    sex: z.enum(["male", "female"]).nullable().optional(),
    isDefault: z.boolean().optional(),
    measurements: measurementsSchema.optional(),
    photos: photosSchema.optional(),
    stylist: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const profileIdSchema = z.object({ id: identifier });

export const listBodyProfilesQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().trim().min(1).max(256).optional(),
  })
  .strict();

export const estimateFieldsSchema = z
  .object({
    sex: z.enum(["male", "female"]),
    heightCm: finiteNumber,
    weightKg: finiteNumber,
  })
  .strict();
