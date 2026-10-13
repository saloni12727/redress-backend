import { DataTypes } from "sequelize";

/*
|--------------------------------------------------------------------------
| Create Permissions Table
|--------------------------------------------------------------------------
|
| Permissions define individual actions that can be assigned to roles.
|
| Examples:
|
| platform.products.view
| platform.vendors.approve
| vendor.products.create
| vendor.orders.update
|
*/

export async function up({ context: queryInterface }) {
  await queryInterface.createTable("permissions", {
    /*
      |--------------------------------------------------------------------------
      | Primary Key
      |--------------------------------------------------------------------------
      */

    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    /*
      |--------------------------------------------------------------------------
      | Stable Permission Code
      |--------------------------------------------------------------------------
      |
      | This is the value backend authorization logic will use.
      |
      | Format:
      |
      | scope.module.action
      |
      | Examples:
      |
      | platform.vendors.approve
      | vendor.products.create
      |
      */

    code: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },

    /*
      |--------------------------------------------------------------------------
      | Module
      |--------------------------------------------------------------------------
      |
      | Used to group permissions in Admin/Vendor UI.
      |
      | Examples:
      |
      | products
      | vendors
      | orders
      | roles
      |
      */

    module: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },

    /*
      |--------------------------------------------------------------------------
      | Scope
      |--------------------------------------------------------------------------
      |
      | platform → Redress Admin Panel
      | vendor   → Vendor Portal
      | customer → Customer-side permissions if needed later
      |
      */

    scope: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },

    /*
      |--------------------------------------------------------------------------
      | Description
      |--------------------------------------------------------------------------
      |
      | Internal developer/admin description.
      |
      | User-facing Italian/English labels will later come from
      | frontend localization files.
      |
      */

    description: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },

    /*
      |--------------------------------------------------------------------------
      | Active Status
      |--------------------------------------------------------------------------
      |
      | Permission can be disabled without deleting historical
      | role-permission relationships.
      |
      */

    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },

    /*
      |--------------------------------------------------------------------------
      | Timestamps
      |--------------------------------------------------------------------------
      */

    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },

    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  });

  /*
  |--------------------------------------------------------------------------
  | Permission Code Must Be Unique
  |--------------------------------------------------------------------------
  */

  await queryInterface.addIndex("permissions", ["code"], {
    name: "uq_permissions_code",
    unique: true,
  });

  /*
  |--------------------------------------------------------------------------
  | Scope + Module Index
  |--------------------------------------------------------------------------
  |
  | Later UI can efficiently fetch:
  |
  | platform → products
  | vendor → orders
  |
  */

  await queryInterface.addIndex("permissions", ["scope", "module"], {
    name: "idx_permissions_scope_module",
  });
}

/*
|--------------------------------------------------------------------------
| Rollback
|--------------------------------------------------------------------------
*/

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable("permissions");
}
