import { Op, QueryTypes } from "sequelize";

const CATALOG_PERMISSIONS = [
  {
    code: "platform.catalog.view",
    module: "catalog",
    scope: "platform",
    description: "View catalog master data in platform administration",
  },
  {
    code: "platform.catalog.create",
    module: "catalog",
    scope: "platform",
    description: "Create catalog master data in platform administration",
  },
  {
    code: "platform.catalog.update",
    module: "catalog",
    scope: "platform",
    description: "Update catalog master data in platform administration",
  },
  {
    code: "platform.catalog.delete",
    module: "catalog",
    scope: "platform",
    description: "Delete unused catalog master data in platform administration",
  },
];

const CODES = CATALOG_PERMISSIONS.map((permission) => permission.code);

function findPermissions(queryInterface, transaction) {
  return queryInterface.sequelize.query(
    `
      SELECT id, code
      FROM permissions
      WHERE code IN (:codes)
    `,
    {
      replacements: { codes: CODES },
      type: QueryTypes.SELECT,
      transaction,
    },
  );
}

export async function up({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    const existing = await findPermissions(queryInterface, transaction);
    const existingCodes = new Set(existing.map((permission) => permission.code));
    const now = new Date();
    const missing = CATALOG_PERMISSIONS.filter(
      (permission) => !existingCodes.has(permission.code),
    ).map((permission) => ({
      ...permission,
      is_active: true,
      created_at: now,
      updated_at: now,
    }));

    if (missing.length > 0) {
      await queryInterface.bulkInsert("permissions", missing, { transaction });
    }

    const permissions = await findPermissions(queryInterface, transaction);
    const superAdminRows = await queryInterface.sequelize.query(
      `
        SELECT id
        FROM roles
        WHERE code = 'super_admin'
          AND scope = 'platform'
          AND is_active = 1
          AND deleted_at IS NULL
        LIMIT 1
      `,
      { type: QueryTypes.SELECT, transaction },
    );
    const superAdmin = superAdminRows[0];

    if (!superAdmin || permissions.length !== CODES.length) {
      throw new Error("Catalog management permissions could not be initialized");
    }

    const permissionIds = permissions.map((permission) => permission.id);
    const assignments = await queryInterface.sequelize.query(
      `
        SELECT permission_id
        FROM role_permissions
        WHERE role_id = :roleId
          AND permission_id IN (:permissionIds)
      `,
      {
        replacements: { roleId: superAdmin.id, permissionIds },
        type: QueryTypes.SELECT,
        transaction,
      },
    );
    const assigned = new Set(assignments.map((row) => String(row.permission_id)));
    const missingAssignments = permissionIds
      .filter((permissionId) => !assigned.has(String(permissionId)))
      .map((permissionId) => ({
        role_id: superAdmin.id,
        permission_id: permissionId,
        created_at: now,
        updated_at: now,
      }));

    if (missingAssignments.length > 0) {
      await queryInterface.bulkInsert("role_permissions", missingAssignments, {
        transaction,
      });
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function down({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    const permissions = await findPermissions(queryInterface, transaction);
    const permissionIds = permissions.map((permission) => permission.id);

    if (permissionIds.length > 0) {
      await queryInterface.bulkDelete(
        "role_permissions",
        { permission_id: { [Op.in]: permissionIds } },
        { transaction },
      );
    }

    await queryInterface.bulkDelete(
      "permissions",
      { code: { [Op.in]: CODES } },
      { transaction },
    );

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
