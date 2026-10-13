import { AccountRole, Permission, Role, RolePermission } from "../../models/index.js";
import { sequelize } from "../../config/database.js";

import { AdminRoleError, roleNotFound } from "./admin-roles.error.js";

const plain = (value) => value?.get ? value.get({ plain: true }) : value;
const id = (value) => String(value);

function roleDto(input) {
  const role = plain(input);
  return {
    id: id(role.id),
    code: role.code,
    name: role.name,
    scope: role.scope,
    isSystem: Boolean(role.isSystem),
    isActive: Boolean(role.isActive),
    permissions: (role.permissions ?? []).map((permission) => ({
      id: id(permission.id),
      code: permission.code,
      module: permission.module,
      description: permission.description,
      scope: permission.scope,
    })),
    createdAt: role.createdAt ? new Date(role.createdAt).toISOString() : null,
    updatedAt: role.updatedAt ? new Date(role.updatedAt).toISOString() : null,
  };
}

function permissionDto(input) {
  const permission = plain(input);
  return { id: id(permission.id), code: permission.code, module: permission.module, description: permission.description, scope: permission.scope };
}

const includePermissions = [{ model: Permission, as: "permissions", through: { attributes: [] }, where: { scope: "platform" }, required: false }];

async function getPlatformRole(roleId, options = {}) {
  const role = await Role.findOne({ where: { id: roleId, scope: "platform" }, include: includePermissions, ...options });
  if (!role) throw roleNotFound();
  return role;
}

async function assertPlatformPermissions(permissionIds, transaction) {
  const permissions = await Permission.findAll({ where: { id: permissionIds, scope: "platform", isActive: true }, transaction });
  if (permissions.length !== permissionIds.length) {
    throw new AdminRoleError("One or more selected permissions are unavailable.", { code: "ROLE_PERMISSION_INVALID" });
  }
}

async function replacePermissions(roleId, permissionIds, transaction) {
  await assertPlatformPermissions(permissionIds, transaction);
  await RolePermission.destroy({ where: { roleId }, transaction });
  if (permissionIds.length) {
    await RolePermission.bulkCreate(permissionIds.map((permissionId) => ({ roleId, permissionId })), { transaction });
  }
}

export async function listAdminRoles() {
  const roles = await Role.findAll({ where: { scope: "platform" }, include: includePermissions, order: [["is_system", "DESC"], ["name", "ASC"]] });
  return { items: roles.map(roleDto) };
}

export async function listPlatformPermissions() {
  const permissions = await Permission.findAll({ where: { scope: "platform", isActive: true }, order: [["module", "ASC"], ["code", "ASC"]] });
  return { items: permissions.map(permissionDto) };
}

export async function createAdminRole(payload) {
  const transaction = await sequelize.transaction();
  try {
    const existing = await Role.findOne({ where: { code: payload.code }, transaction });
    if (existing) throw new AdminRoleError("The role code is already in use.", { statusCode: 409, code: "ROLE_CODE_EXISTS" });
    const role = await Role.create({ code: payload.code, name: payload.name, scope: "platform", isSystem: false, isActive: true }, { transaction });
    await replacePermissions(role.id, payload.permissionIds, transaction);
    await transaction.commit();
    return roleDto(await getPlatformRole(role.id));
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    throw error;
  }
}

export async function updateAdminRole(roleId, payload) {
  const transaction = await sequelize.transaction();
  try {
    const role = await getPlatformRole(roleId, { transaction, lock: transaction.LOCK.UPDATE });
    if (role.isSystem) throw new AdminRoleError("System roles cannot be changed here.", { statusCode: 409, code: "ROLE_SYSTEM_PROTECTED" });
    const values = {};
    if (payload.name !== undefined) values.name = payload.name;
    if (payload.isActive !== undefined) values.isActive = payload.isActive;
    if (Object.keys(values).length) await role.update(values, { transaction });
    if (payload.permissionIds !== undefined) await replacePermissions(role.id, payload.permissionIds, transaction);
    await transaction.commit();
    return roleDto(await getPlatformRole(role.id));
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    throw error;
  }
}

export async function deleteAdminRole(roleId) {
  const transaction = await sequelize.transaction();
  try {
    const role = await getPlatformRole(roleId, { transaction, lock: transaction.LOCK.UPDATE });
    if (role.isSystem) throw new AdminRoleError("System roles cannot be deleted.", { statusCode: 409, code: "ROLE_SYSTEM_PROTECTED" });
    if (await AccountRole.count({ where: { roleId: role.id }, transaction })) throw new AdminRoleError("This role is still assigned to an account and cannot be deleted.", { statusCode: 409, code: "ROLE_IN_USE" });
    await RolePermission.destroy({ where: { roleId: role.id }, transaction });
    await role.destroy({ transaction });
    await transaction.commit();
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    throw error;
  }
}
