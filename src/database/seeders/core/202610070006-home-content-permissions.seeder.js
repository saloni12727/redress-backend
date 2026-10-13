import { Op, QueryTypes } from "sequelize";

/*
|--------------------------------------------------------------------------
| Home Content Permissions
|--------------------------------------------------------------------------
|
| This is deliberately an additive seeder rather than an edit to the original
| core-permissions seeder. Umzug records executed seeders by name, so a new
| file is required for already initialized Redress databases to receive the
| Home CMS permissions.
|
*/

const HOME_CONTENT_PERMISSIONS = [
  {
    code: "platform.home_content.view",
    module: "home_content",
    scope: "platform",
    description: "View Home content placements in the platform administration dashboard",
  },
  {
    code: "platform.home_content.create",
    module: "home_content",
    scope: "platform",
    description: "Create draft Home content placements",
  },
  {
    code: "platform.home_content.update",
    module: "home_content",
    scope: "platform",
    description: "Edit Home content placements",
  },
  {
    code: "platform.home_content.publish",
    module: "home_content",
    scope: "platform",
    description: "Publish, schedule, unpublish, and archive Home content placements",
  },
  {
    code: "platform.home_content.delete",
    module: "home_content",
    scope: "platform",
    description: "Delete Home content placements",
  },
];

const HOME_CONTENT_PERMISSION_CODES = HOME_CONTENT_PERMISSIONS.map(
  (permission) => permission.code,
);

async function findPermissions(queryInterface, transaction) {
  return queryInterface.sequelize.query(
    `
      SELECT id, code
      FROM permissions
      WHERE code IN (:codes)
    `,
    {
      replacements: { codes: HOME_CONTENT_PERMISSION_CODES },
      type: QueryTypes.SELECT,
      transaction,
    },
  );
}

export async function up({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    const existingPermissions = await findPermissions(queryInterface, transaction);
    const existingCodes = new Set(
      existingPermissions.map((permission) => permission.code),
    );
    const now = new Date();
    const missingPermissions = HOME_CONTENT_PERMISSIONS.filter(
      (permission) => !existingCodes.has(permission.code),
    ).map((permission) => ({
      ...permission,
      is_active: true,
      created_at: now,
      updated_at: now,
    }));

    if (missingPermissions.length > 0) {
      await queryInterface.bulkInsert("permissions", missingPermissions, {
        transaction,
      });
    }

    const permissions = await findPermissions(queryInterface, transaction);

    if (permissions.length !== HOME_CONTENT_PERMISSION_CODES.length) {
      throw new Error("Home content permissions could not be initialized");
    }

    const roles = await queryInterface.sequelize.query(
      `
        SELECT id
        FROM roles
        WHERE code = :roleCode
        LIMIT 1
      `,
      {
        replacements: { roleCode: "super_admin" },
        type: QueryTypes.SELECT,
        transaction,
      },
    );
    const superAdmin = roles[0];

    if (!superAdmin) {
      throw new Error("The super_admin role is required for Home content permissions");
    }

    const permissionIds = permissions.map((permission) => permission.id);
    const existingAssignments = await queryInterface.sequelize.query(
      `
        SELECT permission_id
        FROM role_permissions
        WHERE role_id = :roleId
          AND permission_id IN (:permissionIds)
      `,
      {
        replacements: {
          roleId: superAdmin.id,
          permissionIds,
        },
        type: QueryTypes.SELECT,
        transaction,
      },
    );
    const assignedPermissionIds = new Set(
      existingAssignments.map((assignment) => String(assignment.permission_id)),
    );
    const missingAssignments = permissionIds
      .filter((permissionId) => !assignedPermissionIds.has(String(permissionId)))
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
        {
          permission_id: {
            [Op.in]: permissionIds,
          },
        },
        { transaction },
      );
    }

    await queryInterface.bulkDelete(
      "permissions",
      {
        code: {
          [Op.in]: HOME_CONTENT_PERMISSION_CODES,
        },
      },
      { transaction },
    );

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
