import { QueryTypes } from "sequelize";

/*
|--------------------------------------------------------------------------
| Core RBAC Assignment
|--------------------------------------------------------------------------
|
| Default security strategy:
|
| super_admin
| → all PLATFORM permissions
|
| admin
| → platform.dashboard.view only
|
| vendor_owner
| → all VENDOR permissions
|
| vendor_staff
| → vendor.dashboard.view only
|
| customer
| → no admin/vendor RBAC permissions
|
| This follows a default-deny approach.
|
*/

const REQUIRED_ROLE_CODES = [
  "super_admin",
  "admin",
  "vendor_owner",
  "vendor_staff",
];

/*
|--------------------------------------------------------------------------
| Create Pair Key
|--------------------------------------------------------------------------
*/

function createPairKey(roleId, permissionId) {
  return `${roleId}:${permissionId}`;
}

/*
|--------------------------------------------------------------------------
| Seeder UP
|--------------------------------------------------------------------------
*/

export async function up({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    /*
    |--------------------------------------------------------------------------
    | Load Required Roles
    |--------------------------------------------------------------------------
    */

    const roles = await queryInterface.sequelize.query(
      `
          SELECT
            id,
            code,
            scope
          FROM roles
          WHERE code IN (:codes)
            AND is_active = 1
            AND deleted_at IS NULL
        `,

      {
        replacements: {
          codes: REQUIRED_ROLE_CODES,
        },

        type: QueryTypes.SELECT,

        transaction,
      },
    );

    /*
    |--------------------------------------------------------------------------
    | Validate Roles
    |--------------------------------------------------------------------------
    */

    const roleByCode = new Map(roles.map((role) => [role.code, role]));

    for (const roleCode of REQUIRED_ROLE_CODES) {
      if (!roleByCode.has(roleCode)) {
        throw new Error(`Required role not found: ${roleCode}`);
      }
    }

    /*
    |--------------------------------------------------------------------------
    | Load Active Permissions
    |--------------------------------------------------------------------------
    */

    const permissions = await queryInterface.sequelize.query(
      `
          SELECT
            id,
            code,
            scope
          FROM permissions
          WHERE is_active = 1
        `,

      {
        type: QueryTypes.SELECT,

        transaction,
      },
    );

    const permissionByCode = new Map(
      permissions.map((permission) => [permission.code, permission]),
    );

    /*
    |--------------------------------------------------------------------------
    | Validate Required Base Permissions
    |--------------------------------------------------------------------------
    */

    const requiredBasePermissions = [
      "platform.dashboard.view",
      "vendor.dashboard.view",
    ];

    for (const permissionCode of requiredBasePermissions) {
      if (!permissionByCode.has(permissionCode)) {
        throw new Error(`Required permission not found: ${permissionCode}`);
      }
    }

    /*
    |--------------------------------------------------------------------------
    | Prepare Assignments
    |--------------------------------------------------------------------------
    */

    const assignments = [];

    /*
    |--------------------------------------------------------------------------
    | Super Admin
    |--------------------------------------------------------------------------
    |
    | Gets every active PLATFORM permission.
    |
    */

    const superAdmin = roleByCode.get("super_admin");

    const platformPermissions = permissions.filter(
      (permission) => permission.scope === "platform",
    );

    for (const permission of platformPermissions) {
      assignments.push({
        role_id: superAdmin.id,

        permission_id: permission.id,
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Admin
    |--------------------------------------------------------------------------
    |
    | Generic platform sub-admin receives only
    | dashboard access by default.
    |
    | Additional access will come from custom
    | roles created in Admin Panel.
    |
    */

    const admin = roleByCode.get("admin");

    const platformDashboard = permissionByCode.get("platform.dashboard.view");

    assignments.push({
      role_id: admin.id,

      permission_id: platformDashboard.id,
    });

    /*
    |--------------------------------------------------------------------------
    | Vendor Owner
    |--------------------------------------------------------------------------
    |
    | Gets every active VENDOR permission.
    |
    */

    const vendorOwner = roleByCode.get("vendor_owner");

    const vendorPermissions = permissions.filter(
      (permission) => permission.scope === "vendor",
    );

    for (const permission of vendorPermissions) {
      assignments.push({
        role_id: vendorOwner.id,

        permission_id: permission.id,
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Vendor Staff
    |--------------------------------------------------------------------------
    |
    | Generic vendor staff receives only
    | vendor dashboard access by default.
    |
    | Additional permissions will come from
    | custom vendor roles.
    |
    */

    const vendorStaff = roleByCode.get("vendor_staff");

    const vendorDashboard = permissionByCode.get("vendor.dashboard.view");

    assignments.push({
      role_id: vendorStaff.id,

      permission_id: vendorDashboard.id,
    });

    /*
    |--------------------------------------------------------------------------
    | Existing Assignments
    |--------------------------------------------------------------------------
    |
    | Makes the data operation safe if the expected
    | relations already exist.
    |
    */

    const roleIds = [
      ...new Set(assignments.map((assignment) => assignment.role_id)),
    ];

    const existingAssignments = await queryInterface.sequelize.query(
      `
          SELECT
            role_id,
            permission_id
          FROM role_permissions
          WHERE role_id IN (:roleIds)
        `,

      {
        replacements: {
          roleIds,
        },

        type: QueryTypes.SELECT,

        transaction,
      },
    );

    const existingPairKeys = new Set(
      existingAssignments.map((assignment) =>
        createPairKey(assignment.role_id, assignment.permission_id),
      ),
    );

    /*
    |--------------------------------------------------------------------------
    | Insert Missing Assignments
    |--------------------------------------------------------------------------
    */

    const now = new Date();

    const missingAssignments = assignments
      .filter(
        (assignment) =>
          !existingPairKeys.has(
            createPairKey(assignment.role_id, assignment.permission_id),
          ),
      )
      .map((assignment) => ({
        ...assignment,

        created_at: now,

        updated_at: now,
      }));

    if (missingAssignments.length > 0) {
      await queryInterface.bulkInsert(
        "role_permissions",

        missingAssignments,

        {
          transaction,
        },
      );
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();

    throw error;
  }
}

/*
|--------------------------------------------------------------------------
| Seeder DOWN
|--------------------------------------------------------------------------
|
| Important:
|
| Umzug rolls seeders back in reverse order.
|
| So any future role-permission seeders should
| be reverted before this one.
|
*/

export async function down({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    /*
    |--------------------------------------------------------------------------
    | Remove Super Admin Platform Assignments
    |--------------------------------------------------------------------------
    */

    await queryInterface.sequelize.query(
      `
        DELETE rp
        FROM role_permissions rp

        INNER JOIN roles r
          ON r.id = rp.role_id

        INNER JOIN permissions p
          ON p.id = rp.permission_id

        WHERE
          (
            r.code = 'super_admin'
            AND p.scope = 'platform'
          )

          OR
          (
            r.code = 'admin'
            AND p.code = 'platform.dashboard.view'
          )

          OR
          (
            r.code = 'vendor_owner'
            AND p.scope = 'vendor'
          )

          OR
          (
            r.code = 'vendor_staff'
            AND p.code = 'vendor.dashboard.view'
          )
      `,

      {
        type: QueryTypes.DELETE,

        transaction,
      },
    );

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();

    throw error;
  }
}
