import { sequelize } from "../../config/database.js";
import { Account, AccountRole, Role, Vendor, VendorUser } from "../../models/index.js";

export function withTransaction(callback) { return sequelize.transaction(callback); }
export function findVendorByCode(code, options = {}) { return Vendor.findOne({ where: { code }, paranoid: false, ...options }); }
export function findVendorBySlug(slug, options = {}) { return Vendor.findOne({ where: { slug }, paranoid: false, ...options }); }
export function findVendorById(id, options = {}) { return Vendor.findByPk(id, options); }
export function createVendor(values, options = {}) { return Vendor.create(values, options); }
export function updateVendor(vendor, values, options = {}) { return vendor.update(values, options); }
export function destroyVendor(vendor, options = {}) { return vendor.destroy(options); }
export function findMembership(accountId, vendorId, options = {}) { const where = { accountId, status: "active" }; if (vendorId) where.vendorId = vendorId; return VendorUser.findAll({ where, include: [{ model: Vendor, as: "vendor" }], order: [["isOwner", "DESC"], ["vendorId", "ASC"]], ...options }); }
export function findMembershipById(vendorId, id, options = {}) { return VendorUser.findOne({ where: { id, vendorId }, include: [{ model: Account, as: "account" }], ...options }); }
export function listStaff(vendorId, options = {}) { return VendorUser.findAll({ where: { vendorId }, include: [{ model: Account, as: "account" }], order: [["isOwner", "DESC"], ["id", "ASC"]], ...options }); }
export function createMembership(values, options = {}) { return VendorUser.create(values, options); }
export function updateMembership(membership, values, options = {}) { return membership.update(values, options); }
export function findAccountByEmail(email, options = {}) { return Account.unscoped().findOne({ where: { email }, ...options }); }
export function createAccount(values, options = {}) { return Account.create(values, options); }
export function findRole(code, options = {}) { return Role.findOne({ where: { code, isActive: true }, ...options }); }
export function assignRole(accountId, roleId, options = {}) { return AccountRole.findOrCreate({ where: { accountId, roleId }, defaults: { accountId, roleId }, ...options }); }
