import { getMediaUrl } from "../../services/media/media-storage.service.js";
import { AdminVendorError, vendorNotFound } from "./admin-vendors.error.js";
import * as repository from "./admin-vendors.repository.js";

const plain = (value) => typeof value?.get === "function" ? value.get({ plain: true }) : value;
const id = (value) => value === null || value === undefined ? null : String(value);
const date = (value) => value ? new Date(value).toISOString() : null;
const bool = (value) => value === true || value === 1 || value === "1";
function error(message, options = {}) { return new AdminVendorError(message, options); }

export function vendorDto(input) {
  const vendor = plain(input);
  const ownerMembership = (vendor.vendorUsers ?? []).find((item) => bool(item.isOwner));
  const owner = ownerMembership?.account ? plain(ownerMembership.account) : null;
  return {
    id: id(vendor.id), code: vendor.code, slug: vendor.slug, displayName: vendor.displayName,
    legalName: vendor.legalName ?? null, email: vendor.email ?? null, phone: vendor.phone ?? null,
    status: vendor.status, approvalStatus: vendor.approvalStatus,
    commission: { type: vendor.commissionType, value: String(vendor.commissionValue) },
    defaultCurrencyCode: vendor.defaultCurrencyCode, countryCode: vendor.countryCode ?? null,
    taxIdentifier: vendor.taxIdentifier ?? null, registrationNumber: vendor.registrationNumber ?? null,
    websiteUrl: vendor.websiteUrl ?? null, logoUrl: vendor.logoKey ? getMediaUrl(vendor.logoKey) : null,
    rejectionReason: vendor.rejectionReason ?? null, approvedAt: date(vendor.approvedAt), suspendedAt: date(vendor.suspendedAt),
    owner: owner ? { accountId: id(ownerMembership.accountId), email: owner.email ?? null, firstName: owner.firstName ?? null, lastName: owner.lastName ?? null, displayName: owner.displayName ?? null } : null,
    createdAt: date(vendor.createdAt), updatedAt: date(vendor.updatedAt),
  };
}

async function vendorRecord(vendorId) {
  const vendor = await repository.findVendorById(vendorId);
  if (!vendor) throw vendorNotFound();
  return vendor;
}

export async function listVendorOnboardingApplications(filters) {
  const result = await repository.findVendors(filters);
  return { items: result.rows.map(vendorDto), pagination: { page: filters.page, limit: filters.limit, total: result.total, totalPages: result.total ? Math.ceil(result.total / filters.limit) : 0 } };
}

export async function getAdminVendor(vendorId) {
  return vendorDto(await vendorRecord(vendorId));
}

export async function approveVendor({ vendorId }) {
  const vendor = await vendorRecord(vendorId);
  if (vendor.approvalStatus !== "pending") throw error("Only a pending vendor application can be approved.", { statusCode: 409, code: "VENDOR_NOT_PENDING" });
  const updated = await repository.updateVendor(vendor, { approvalStatus: "approved", approvedAt: new Date(), rejectionReason: null });
  return vendorDto(updated);
}

export async function rejectVendor({ vendorId, reason }) {
  const vendor = await vendorRecord(vendorId);
  if (vendor.approvalStatus !== "pending") throw error("Only a pending vendor application can be rejected.", { statusCode: 409, code: "VENDOR_NOT_PENDING" });
  const updated = await repository.updateVendor(vendor, { approvalStatus: "rejected", status: "inactive", rejectionReason: reason, approvedAt: null, suspendedAt: null });
  return vendorDto(updated);
}

export async function updateAdminVendorStatus({ vendorId, status }) {
  const vendor = await vendorRecord(vendorId);
  if (vendor.status === status) throw error(`This vendor is already ${status}.`, { statusCode: 409, code: "VENDOR_STATUS_UNCHANGED" });
  if (status === "active" && vendor.approvalStatus !== "approved") throw error("Only an approved vendor can be activated.", { statusCode: 409, code: "VENDOR_NOT_APPROVED" });
  const updated = await repository.updateVendor(vendor, { status, suspendedAt: status === "suspended" ? new Date() : null });
  return vendorDto(updated);
}
