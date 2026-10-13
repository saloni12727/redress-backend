import { AdminProductError, adminProductNotFound } from "./admin-products.error.js";
import * as repository from "../vendor-products/vendor-products.repository.js";
import { assertSubmittable, productDto } from "../vendor-products/vendor-products.service.js";

const plain = (value) => typeof value?.get === "function" ? value.get({ plain: true }) : value;
const id = (value) => value === null || value === undefined ? null : String(value);
const date = (value) => value ? new Date(value).toISOString() : null;

function error(message, options = {}) { return new AdminProductError(message, options); }

async function productForReview(productId, transaction) {
  const product = await repository.findProductById(productId, { transaction, lock: transaction?.LOCK?.UPDATE });
  if (!product) throw adminProductNotFound();
  return product;
}

function reviewDto(details) {
  const dto = productDto(details);
  const vendor = plain(details.product)?.vendor;
  return { ...dto, vendor: vendor ? { id: id(vendor.id), code: vendor.code, slug: vendor.slug, displayName: vendor.displayName, status: vendor.status, approvalStatus: vendor.approvalStatus } : null };
}

export async function listSubmittedProducts(filters) {
  const result = await repository.findSubmittedProducts(filters);
  return {
    items: await Promise.all(result.rows.map(async (item) => reviewDto(await repository.findProductDetails(item.id)))),
    pagination: { page: filters.page, limit: filters.limit, total: result.total, totalPages: result.total ? Math.ceil(result.total / filters.limit) : 0 },
  };
}

export async function getAdminProduct(productId) {
  const details = await repository.findProductDetails(productId);
  if (!details.product) throw adminProductNotFound();
  return reviewDto(details);
}

export async function approveAdminProduct({ productId, accountId }) {
  await repository.withTransaction(async (transaction) => {
    const product = await productForReview(productId, transaction);
    if (product.status !== "draft" || product.approvalStatus !== "pending") throw error("Only a submitted draft product can be approved.", { statusCode: 409, code: "PRODUCT_NOT_PENDING" });
    await assertSubmittable(productId, transaction);
    const now = new Date();
    await repository.updateProduct(product, { approvalStatus: "approved", rejectionReason: null, approvedAt: now, approvedByAccountId: accountId }, { transaction });
    await repository.approveProductMedia(productId, now, { transaction });
  });
  return getAdminProduct(productId);
}

export async function rejectAdminProduct({ productId, accountId, reason }) {
  await repository.withTransaction(async (transaction) => {
    const product = await productForReview(productId, transaction);
    if (product.status !== "draft" || product.approvalStatus !== "pending") throw error("Only a submitted draft product can be rejected.", { statusCode: 409, code: "PRODUCT_NOT_PENDING" });
    await repository.updateProduct(product, { approvalStatus: "rejected", rejectionReason: reason, approvedAt: null, approvedByAccountId: accountId }, { transaction });
  });
  return getAdminProduct(productId);
}

export async function publishAdminProduct({ productId, accountId }) {
  await repository.withTransaction(async (transaction) => {
    const product = await productForReview(productId, transaction);
    if (product.status !== "draft" || product.approvalStatus !== "approved") throw error("Only an approved draft product can be published.", { statusCode: 409, code: "PRODUCT_NOT_APPROVED" });
    const details = await repository.findProductDetails(productId, { transaction });
    const vendor = plain(details.product)?.vendor;
    if (!vendor || vendor.status !== "active" || vendor.approvalStatus !== "approved") throw error("The product vendor must be approved and active before publishing.", { statusCode: 409, code: "VENDOR_NOT_PUBLISHABLE" });
    await repository.updateProduct(product, { status: "published", visibility: "public", publishedAt: new Date(), approvedByAccountId: accountId }, { transaction });
  });
  return getAdminProduct(productId);
}

export async function unpublishAdminProduct({ productId, accountId }) {
  await repository.withTransaction(async (transaction) => {
    const product = await productForReview(productId, transaction);
    if (product.status !== "published") throw error("Only a published product can be unpublished.", { statusCode: 409, code: "PRODUCT_NOT_PUBLISHED" });
    await repository.updateProduct(product, { status: "draft", visibility: "hidden", publishedAt: null, approvedByAccountId: accountId }, { transaction });
  });
  return getAdminProduct(productId);
}
