import { Op } from "sequelize";

import { Vendor, VendorUser, Account } from "../../models/index.js";

function whereFor(filters) {
  const where = {};
  if (filters.approvalStatus) where.approvalStatus = filters.approvalStatus;
  if (filters.status) where.status = filters.status;
  if (filters.q) where[Op.or] = [
    { code: { [Op.like]: `%${filters.q}%` } },
    { slug: { [Op.like]: `%${filters.q}%` } },
    { displayName: { [Op.like]: `%${filters.q}%` } },
    { email: { [Op.like]: `%${filters.q}%` } },
  ];
  return where;
}

const ownerInclude = {
  model: VendorUser,
  as: "vendorUsers",
  where: { isOwner: true },
  required: false,
  include: [{ model: Account, as: "account" }],
};

export async function findVendors(filters) {
  const result = await Vendor.findAndCountAll({
    where: whereFor(filters),
    include: [ownerInclude],
    distinct: true,
    order: [["created_at", "ASC"], ["id", "ASC"]],
    limit: filters.limit,
    offset: (filters.page - 1) * filters.limit,
  });
  return { rows: result.rows, total: result.count };
}

export function findVendorById(id, options = {}) {
  return Vendor.findByPk(id, { include: [ownerInclude], ...options });
}

export function updateVendor(vendor, values, options = {}) {
  return vendor.update(values, options);
}
