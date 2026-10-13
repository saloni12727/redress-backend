import { z } from "zod";

const id = z.coerce.number().int().positive().safe();
const amount = z.coerce.number().finite().positive().max(999999);
const nonEmpty = (max) => z.string().trim().min(1).max(max);
const optionalText = (max) => z.preprocess((value) => value === "" ? null : value, z.string().trim().max(max).nullable().optional());

export const cartItemParamsSchema = z.object({ id });
export const addCartItemSchema = z.object({
  productId: id,
  colorId: nonEmpty(50),
  size: nonEmpty(50),
  qty: z.coerce.number().int().min(1).max(10).default(1),
}).strict();
export const updateCartItemSchema = z.object({ qty: z.coerce.number().int().min(0).max(10) }).strict();

export const addressParamsSchema = z.object({ id });
const addressFields = {
  label: nonEmpty(50), fullName: nonEmpty(120), phone: z.string().trim().regex(/^\+[1-9]\d{7,14}$/),
  line1: nonEmpty(200), line2: optionalText(200), city: nonEmpty(100), state: optionalText(100),
  postalCode: nonEmpty(20), country: z.string().trim().length(2).transform((value) => value.toUpperCase()), isDefault: z.boolean().optional(),
};
export const createAddressSchema = z.object(addressFields).strict();
export const updateAddressSchema = z.object({
  label: addressFields.label.optional(), fullName: addressFields.fullName.optional(), phone: addressFields.phone.optional(),
  line1: addressFields.line1.optional(), line2: optionalText(200), city: addressFields.city.optional(),
  state: optionalText(100), postalCode: addressFields.postalCode.optional(), country: addressFields.country.optional(), isDefault: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0);

export const quoteSchema = z.object({
  source: z.literal("cart").default("cart"), addressId: id.optional(),
  shippingMethod: z.enum(["standard", "express"]).default("standard"),
  paymentMode: z.enum(["cod", "card"]).default("cod"),
}).strict();
export const checkoutSchema = z.object({
  source: z.literal("cart"), addressId: id, shippingMethod: z.enum(["standard", "express"]), paymentMode: z.enum(["cod", "card"]),
}).strict();
export const orderParamsSchema = z.object({ id });
const cancellationNote = optionalText(1000);
export const cancelOrderSchema = z.object({
  reason: z.enum(["changedMind", "wrongSize", "tooLate", "foundCheaper", "other"]),
  note: cancellationNote,
}).strict().superRefine((value, context) => {
  if (value.reason === "other" && !value.note) {
    context.addIssue({ code: "custom", path: ["note"], message: "A note is required for this reason." });
  }
});
const returnItemSchema = z.object({
  orderItemId: id,
  quantity: z.coerce.number().int().min(1).max(10),
  reason: z.enum(["sizeFit", "quality", "notAsDescribed", "changedMind", "damaged", "other"]),
  note: cancellationNote,
}).strict().superRefine((value, context) => {
  if (value.reason === "other" && !value.note) {
    context.addIssue({ code: "custom", path: ["note"], message: "A note is required for this reason." });
  }
});
export const createReturnRequestSchema = z.object({
  orderId: id,
  items: z.array(returnItemSchema).min(1).max(50),
}).strict().refine(
  ({ items }) => new Set(items.map(({ orderItemId }) => orderItemId)).size === items.length,
  { path: ["items"], message: "Each order item may only be included once." },
);
const returnStatusValues = ["requested", "approved", "inTransit", "received", "refundPending", "refunded", "rejected", "cancelled"];
const csvValues = (values) => z.preprocess(
  (value) => {
    if (value === undefined || value === null || value === "") return undefined;
    const raw = Array.isArray(value) ? value.join(",") : String(value);
    return raw.split(",").map((item) => item.trim()).filter(Boolean);
  },
  z.array(z.enum(values)).min(1).max(values.length).optional(),
);
export const returnParamsSchema = z.object({ id });
export const listReturnsSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: csvValues(returnStatusValues),
  orderId: id.optional(),
}).strict();
export const cancelReturnSchema = z.object({}).strict();
export const listOrdersSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1), limit: z.coerce.number().int().min(1).max(50).default(20),
}).strict();
export const confirmPaymentSchema = z.object({ providerPaymentId: nonEmpty(191) }).strict();
