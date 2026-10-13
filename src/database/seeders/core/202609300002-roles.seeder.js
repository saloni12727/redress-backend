import { Op, QueryTypes } from "sequelize";

/*
|--------------------------------------------------------------------------
| Redress Core Roles
|--------------------------------------------------------------------------
|
| These are mandatory system roles.
|
| They are not demo records.
|
*/

const CORE_ROLES = [
  /*
  |--------------------------------------------------------------------------
  | Platform Roles
  |--------------------------------------------------------------------------
  */

  {
    code: "super_admin",

    name: "Super Admin",

    scope: "platform",

    is_system: true,

    is_active: true,
  },

  {
    code: "admin",

    name: "Admin",

    scope: "platform",

    is_system: true,

    is_active: true,
  },

  /*
  |--------------------------------------------------------------------------
  | Vendor Roles
  |--------------------------------------------------------------------------
  */

  {
    code: "vendor_owner",

    name: "Vendor Owner",

    scope: "vendor",

    is_system: true,

    is_active: true,
  },

  {
    code: "vendor_staff",

    name: "Vendor Staff",

    scope: "vendor",

    is_system: true,

    is_active: true,
  },

  /*
  |--------------------------------------------------------------------------
  | Customer Role
  |--------------------------------------------------------------------------
  */

  {
    code: "customer",

    name: "Customer",

    scope: "customer",

    is_system: true,

    is_active: true,
  },
];

const CORE_ROLE_CODES = CORE_ROLES.map((role) => role.code);

/*
|--------------------------------------------------------------------------
| Seed Roles
|--------------------------------------------------------------------------
*/

export async function up({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    /*
    |--------------------------------------------------------------------------
    | Find Existing Core Roles
    |--------------------------------------------------------------------------
    |
    | This makes the data operation safe even if
    | records already exist.
    |
    */

    const existingRoles = await queryInterface.sequelize.query(
      `
          SELECT code
          FROM roles
          WHERE code IN (
            'super_admin',
            'admin',
            'vendor_owner',
            'vendor_staff',
            'customer'
          )
        `,

      {
        type: QueryTypes.SELECT,

        transaction,
      },
    );

    const existingCodes = new Set(existingRoles.map((role) => role.code));

    /*
    |--------------------------------------------------------------------------
    | Insert Missing Roles Only
    |--------------------------------------------------------------------------
    */

    const now = new Date();

    const missingRoles = CORE_ROLES.filter(
      (role) => !existingCodes.has(role.code),
    ).map((role) => ({
      ...role,

      created_at: now,

      updated_at: now,

      deleted_at: null,
    }));

    if (missingRoles.length > 0) {
      await queryInterface.bulkInsert(
        "roles",

        missingRoles,

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
| Rollback Core Roles
|--------------------------------------------------------------------------
*/

export async function down({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    /*
     * Delete only the roles created by
     * this core seeder.
     *
     * Later, when foreign-key dependent data exists,
     * seeders must be rolled back in reverse order.
     */

    await queryInterface.bulkDelete(
      "roles",

      {
        code: {
          [Op.in]: CORE_ROLE_CODES,
        },
      },

      {
        transaction,
      },
    );

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();

    throw error;
  }
}
