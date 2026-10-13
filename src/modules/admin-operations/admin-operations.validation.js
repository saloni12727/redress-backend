import { z } from "zod";

const queryValue = (schema) => z.preprocess(
  (value) => Array.isArray(value) ? value.at(-1) : value,
  schema,
);
const id = z.coerce.number().int().positive().safe();
const optionalText = (maximum) => z.preprocess(
  (value) => value === "" ? null : value,
  z.string().trim().max(maximum).nullable().optional(),
);
const page = queryValue(z.coerce.number().int().min(1).max(100000).default(1));
const limit = queryValue(z.coerce.number().int().min(1).max(100).default(20));

export const orderIdSchema = z.object({ id });
export const returnIdSchema = z.object({ id });

export const listOrdersSchema = z.object({
  page,
  limit,
  status: queryValue(z.enum(["placed", "confirmed", "packed", "shipped", "outForDelivery", "delivered", "cancelled"]).optional()),
  paymentStatus: queryValue(z.enum(["pending", "paid", "unpaid", "failed"]).optional()),
  q: queryValue(z.string().trim().min(1).max(120).optional()),
}).strict();

export const updateOrderStatusSchema = z.object({
  status: z.enum(["confirmed", "packed", "shipped", "outForDelivery", "delivered", "cancelled"]),
}).strict();

export const updateTrackingSchema = z.object({
  carrier: z.string().trim().min(2).max(120),
  trackingNumber: z.string().trim().min(1).max(191),
  trackingUrl: z.string().trim().url().max(2048).nullable().optional(),
}).strict();

export const listReturnsSchema = z.object({
  page,
  limit,
  status: queryValue(z.enum(["requested", "approved", "inTransit", "received", "refundPending", "refunded", "rejected"]).optional()),
  refundStatus: queryValue(z.enum(["not_started", "pending", "manual", "refunded"]).optional()),
}).strict();

export const refundReturnSchema = z.object({
  refundMethod: z.enum(["manual", "original_payment"]),
  refundProvider: optionalText(40),
  providerRefundId: optionalText(191),
}).strict().superRefine((value, context) => {
  if (value.refundMethod === "original_payment" && !value.providerRefundId) {
    context.addIssue({ code: "custom", path: ["providerRefundId"], message: "A provider refund identifier is required." });
  }
});
