import { Op, QueryTypes } from "sequelize";

/*
|--------------------------------------------------------------------------
| Redress Core Permissions
|--------------------------------------------------------------------------
|
| Naming convention:
|
| scope.module.action
|
| Examples:
|
| platform.products.view
| vendor.orders.update
|
| Permissions are system-defined.
|
| Admin/Vendor users will create custom ROLES and select
| permissions from this master list.
|
*/

const CORE_PERMISSIONS = [
  /*
  |--------------------------------------------------------------------------
  | PLATFORM - Dashboard
  |--------------------------------------------------------------------------
  */

  {
    code: "platform.dashboard.view",

    module: "dashboard",

    scope: "platform",

    description: "View the platform administration dashboard",
  },

  /*
  |--------------------------------------------------------------------------
  | PLATFORM - Roles
  |--------------------------------------------------------------------------
  */

  {
    code: "platform.roles.view",

    module: "roles",

    scope: "platform",

    description: "View platform roles",
  },

  {
    code: "platform.roles.create",

    module: "roles",

    scope: "platform",

    description: "Create custom platform roles",
  },

  {
    code: "platform.roles.update",

    module: "roles",

    scope: "platform",

    description: "Update custom platform roles",
  },

  {
    code: "platform.roles.delete",

    module: "roles",

    scope: "platform",

    description: "Delete custom platform roles",
  },

  {
    code: "platform.roles.assign_permissions",

    module: "roles",

    scope: "platform",

    description: "Assign permissions to platform roles",
  },

  /*
  |--------------------------------------------------------------------------
  | PLATFORM - Admin Users
  |--------------------------------------------------------------------------
  */

  {
    code: "platform.admins.view",

    module: "admins",

    scope: "platform",

    description: "View platform administrators",
  },

  {
    code: "platform.admins.create",

    module: "admins",

    scope: "platform",

    description: "Create platform administrators",
  },

  {
    code: "platform.admins.update",

    module: "admins",

    scope: "platform",

    description: "Update platform administrators",
  },

  {
    code: "platform.admins.assign_roles",

    module: "admins",

    scope: "platform",

    description: "Assign roles to platform administrators",
  },

  {
    code: "platform.admins.manage_status",

    module: "admins",

    scope: "platform",

    description: "Activate or deactivate platform administrators",
  },

  /*
  |--------------------------------------------------------------------------
  | PLATFORM - Vendors
  |--------------------------------------------------------------------------
  */

  {
    code: "platform.vendors.view",

    module: "vendors",

    scope: "platform",

    description: "View vendors",
  },

  {
    code: "platform.vendors.create",

    module: "vendors",

    scope: "platform",

    description: "Create vendors",
  },

  {
    code: "platform.vendors.update",

    module: "vendors",

    scope: "platform",

    description: "Update vendors",
  },

  {
    code: "platform.vendors.approve",

    module: "vendors",

    scope: "platform",

    description: "Approve or reject vendor registrations",
  },

  {
    code: "platform.vendors.manage_status",

    module: "vendors",

    scope: "platform",

    description: "Activate, suspend, or deactivate vendors",
  },

  /*
  |--------------------------------------------------------------------------
  | PLATFORM - Customers
  |--------------------------------------------------------------------------
  */

  {
    code: "platform.customers.view",

    module: "customers",

    scope: "platform",

    description: "View customer accounts",
  },

  {
    code: "platform.customers.manage_status",

    module: "customers",

    scope: "platform",

    description: "Manage customer account status",
  },

  /*
  |--------------------------------------------------------------------------
  | PLATFORM - Categories
  |--------------------------------------------------------------------------
  */

  {
    code: "platform.categories.view",

    module: "categories",

    scope: "platform",

    description: "View product categories",
  },

  {
    code: "platform.categories.create",

    module: "categories",

    scope: "platform",

    description: "Create product categories",
  },

  {
    code: "platform.categories.update",

    module: "categories",

    scope: "platform",

    description: "Update product categories",
  },

  {
    code: "platform.categories.delete",

    module: "categories",

    scope: "platform",

    description: "Delete product categories",
  },

  /*
  |--------------------------------------------------------------------------
  | PLATFORM - Brands
  |--------------------------------------------------------------------------
  */

  {
    code: "platform.brands.view",

    module: "brands",

    scope: "platform",

    description: "View brands",
  },

  {
    code: "platform.brands.create",

    module: "brands",

    scope: "platform",

    description: "Create brands",
  },

  {
    code: "platform.brands.update",

    module: "brands",

    scope: "platform",

    description: "Update brands",
  },

  {
    code: "platform.brands.delete",

    module: "brands",

    scope: "platform",

    description: "Delete brands",
  },

  /*
  |--------------------------------------------------------------------------
  | PLATFORM - Products
  |--------------------------------------------------------------------------
  */

  {
    code: "platform.products.view",

    module: "products",

    scope: "platform",

    description: "View marketplace products",
  },

  {
    code: "platform.products.update",

    module: "products",

    scope: "platform",

    description: "Update marketplace products",
  },

  {
    code: "platform.products.manage_status",

    module: "products",

    scope: "platform",

    description: "Manage marketplace product status",
  },

  /*
  |--------------------------------------------------------------------------
  | PLATFORM - Orders
  |--------------------------------------------------------------------------
  */

  {
    code: "platform.orders.view",

    module: "orders",

    scope: "platform",

    description: "View marketplace orders",
  },

  {
    code: "platform.orders.update",

    module: "orders",

    scope: "platform",

    description: "Update marketplace orders",
  },

  /*
  |--------------------------------------------------------------------------
  | PLATFORM - Returns
  |--------------------------------------------------------------------------
  */

  {
    code: "platform.returns.view",

    module: "returns",

    scope: "platform",

    description: "View marketplace returns",
  },

  {
    code: "platform.returns.update",

    module: "returns",

    scope: "platform",

    description: "Manage marketplace returns",
  },

  /*
  |--------------------------------------------------------------------------
  | PLATFORM - Payments
  |--------------------------------------------------------------------------
  */

  {
    code: "platform.payments.view",

    module: "payments",

    scope: "platform",

    description: "View payment information",
  },

  {
    code: "platform.refunds.view",

    module: "refunds",

    scope: "platform",

    description: "View refunds",
  },

  {
    code: "platform.refunds.create",

    module: "refunds",

    scope: "platform",

    description: "Initiate eligible refunds",
  },

  /*
  |--------------------------------------------------------------------------
  | PLATFORM - Settlements
  |--------------------------------------------------------------------------
  */

  {
    code: "platform.settlements.view",

    module: "settlements",

    scope: "platform",

    description: "View vendor settlements",
  },

  {
    code: "platform.settlements.manage",

    module: "settlements",

    scope: "platform",

    description: "Manage vendor settlements",
  },

  /*
  |--------------------------------------------------------------------------
  | PLATFORM - AI Jobs
  |--------------------------------------------------------------------------
  */

  {
    code: "platform.ai_jobs.view",

    module: "ai_jobs",

    scope: "platform",

    description: "View AI job status and operational information",
  },

  {
    code: "platform.ai_jobs.retry",

    module: "ai_jobs",

    scope: "platform",

    description: "Retry eligible failed AI jobs",
  },

  {
    code: "platform.ai_jobs.cancel",

    module: "ai_jobs",

    scope: "platform",

    description: "Cancel eligible AI jobs",
  },

  /*
  |--------------------------------------------------------------------------
  | PLATFORM - System Settings
  |--------------------------------------------------------------------------
  */

  {
    code: "platform.settings.view",

    module: "settings",

    scope: "platform",

    description: "View Redress system settings",
  },

  {
    code: "platform.settings.update",

    module: "settings",

    scope: "platform",

    description: "Update Redress system settings",
  },

  /*
  |--------------------------------------------------------------------------
  | VENDOR - Dashboard
  |--------------------------------------------------------------------------
  */

  {
    code: "vendor.dashboard.view",

    module: "dashboard",

    scope: "vendor",

    description: "View the vendor dashboard",
  },

  /*
  |--------------------------------------------------------------------------
  | VENDOR - Roles
  |--------------------------------------------------------------------------
  */

  {
    code: "vendor.roles.view",

    module: "roles",

    scope: "vendor",

    description: "View vendor staff roles",
  },

  {
    code: "vendor.roles.create",

    module: "roles",

    scope: "vendor",

    description: "Create custom vendor staff roles",
  },

  {
    code: "vendor.roles.update",

    module: "roles",

    scope: "vendor",

    description: "Update custom vendor staff roles",
  },

  {
    code: "vendor.roles.delete",

    module: "roles",

    scope: "vendor",

    description: "Delete custom vendor staff roles",
  },

  {
    code: "vendor.roles.assign_permissions",

    module: "roles",

    scope: "vendor",

    description: "Assign vendor permissions to vendor staff roles",
  },

  /*
  |--------------------------------------------------------------------------
  | VENDOR - Staff
  |--------------------------------------------------------------------------
  */

  {
    code: "vendor.staff.view",

    module: "staff",

    scope: "vendor",

    description: "View vendor staff members",
  },

  {
    code: "vendor.staff.create",

    module: "staff",

    scope: "vendor",

    description: "Create vendor staff accounts",
  },

  {
    code: "vendor.staff.update",

    module: "staff",

    scope: "vendor",

    description: "Update vendor staff accounts",
  },

  {
    code: "vendor.staff.assign_roles",

    module: "staff",

    scope: "vendor",

    description: "Assign vendor roles to staff members",
  },

  {
    code: "vendor.staff.manage_status",

    module: "staff",

    scope: "vendor",

    description: "Activate or deactivate vendor staff accounts",
  },

  /*
  |--------------------------------------------------------------------------
  | VENDOR - Products
  |--------------------------------------------------------------------------
  */

  {
    code: "vendor.products.view",

    module: "products",

    scope: "vendor",

    description: "View vendor products",
  },

  {
    code: "vendor.products.create",

    module: "products",

    scope: "vendor",

    description: "Create vendor products",
  },

  {
    code: "vendor.products.update",

    module: "products",

    scope: "vendor",

    description: "Update vendor products",
  },

  {
    code: "vendor.products.delete",

    module: "products",

    scope: "vendor",

    description: "Delete vendor products",
  },

  /*
  |--------------------------------------------------------------------------
  | VENDOR - Inventory
  |--------------------------------------------------------------------------
  */

  {
    code: "vendor.inventory.view",

    module: "inventory",

    scope: "vendor",

    description: "View vendor inventory",
  },

  {
    code: "vendor.inventory.update",

    module: "inventory",

    scope: "vendor",

    description: "Update vendor inventory",
  },

  /*
  |--------------------------------------------------------------------------
  | VENDOR - Orders
  |--------------------------------------------------------------------------
  */

  {
    code: "vendor.orders.view",

    module: "orders",

    scope: "vendor",

    description: "View orders belonging to the vendor",
  },

  {
    code: "vendor.orders.update",

    module: "orders",

    scope: "vendor",

    description: "Update eligible vendor order information",
  },

  /*
  |--------------------------------------------------------------------------
  | VENDOR - Returns
  |--------------------------------------------------------------------------
  */

  {
    code: "vendor.returns.view",

    module: "returns",

    scope: "vendor",

    description: "View returns belonging to the vendor",
  },

  {
    code: "vendor.returns.update",

    module: "returns",

    scope: "vendor",

    description: "Manage eligible vendor returns",
  },

  /*
  |--------------------------------------------------------------------------
  | VENDOR - Settlements
  |--------------------------------------------------------------------------
  */

  {
    code: "vendor.settlements.view",

    module: "settlements",

    scope: "vendor",

    description: "View vendor settlement information",
  },

  /*
  |--------------------------------------------------------------------------
  | VENDOR - Store Settings
  |--------------------------------------------------------------------------
  */

  {
    code: "vendor.settings.view",

    module: "settings",

    scope: "vendor",

    description: "View vendor store settings",
  },

  {
    code: "vendor.settings.update",

    module: "settings",

    scope: "vendor",

    description: "Update vendor store settings",
  },
];

/*
|--------------------------------------------------------------------------
| Core Permission Codes
|--------------------------------------------------------------------------
*/

const CORE_PERMISSION_CODES = CORE_PERMISSIONS.map(
  (permission) => permission.code,
);

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
    | Find Existing Permissions
    |--------------------------------------------------------------------------
    */

    const existingPermissions = await queryInterface.sequelize.query(
      `
          SELECT code
          FROM permissions
          WHERE code IN (:codes)
        `,

      {
        replacements: {
          codes: CORE_PERMISSION_CODES,
        },

        type: QueryTypes.SELECT,

        transaction,
      },
    );

    const existingCodes = new Set(
      existingPermissions.map((permission) => permission.code),
    );

    /*
    |--------------------------------------------------------------------------
    | Insert Missing Permissions
    |--------------------------------------------------------------------------
    */

    const now = new Date();

    const missingPermissions = CORE_PERMISSIONS.filter(
      (permission) => !existingCodes.has(permission.code),
    ).map((permission) => ({
      ...permission,

      is_active: true,

      created_at: now,

      updated_at: now,
    }));

    if (missingPermissions.length > 0) {
      await queryInterface.bulkInsert(
        "permissions",

        missingPermissions,

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
*/

export async function down({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    await queryInterface.bulkDelete(
      "permissions",

      {
        code: {
          [Op.in]: CORE_PERMISSION_CODES,
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
