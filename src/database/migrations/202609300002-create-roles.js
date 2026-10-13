import { DataTypes } from "sequelize";

/*
|--------------------------------------------------------------------------
| Create Roles Table
|--------------------------------------------------------------------------
|
| Stores Redress access roles.
|
| Initial system roles:
|
| super_admin
| admin
| vendor_owner
| vendor_staff
| customer
|
*/

export async function up({ context: queryInterface }) {
  await queryInterface.createTable("roles", {
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
      | Stable Role Code
      |--------------------------------------------------------------------------
      |
      | Application logic will use this value.
      |
      | Examples:
      |
      | super_admin
      | admin
      | vendor_owner
      | vendor_staff
      | customer
      |
      | Never depend on numeric IDs such as:
      |
      | role_id = 1
      |
      */

    code: {
      type: DataTypes.STRING(80),
      allowNull: false,
    },

    /*
      |--------------------------------------------------------------------------
      | Display Name
      |--------------------------------------------------------------------------
      */

    name: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },

    /*
      |--------------------------------------------------------------------------
      | Role Scope
      |--------------------------------------------------------------------------
      |
      | platform → Redress administration
      | vendor   → Vendor portal/team
      | customer → Customer account
      |
      */

    scope: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },

    /*
      |--------------------------------------------------------------------------
      | System Role
      |--------------------------------------------------------------------------
      |
      | true:
      | Built-in Redress role.
      |
      | System roles should not be deleted from
      | normal admin functionality.
      |
      | false:
      | Future custom roles.
      |
      */

    is_system: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    /*
      |--------------------------------------------------------------------------
      | Active Status
      |--------------------------------------------------------------------------
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

    /*
      |--------------------------------------------------------------------------
      | Soft Delete
      |--------------------------------------------------------------------------
      |
      | Mainly useful for future custom roles.
      |
      | System roles will be protected at the
      | service/business-logic level.
      |
      */

    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
  });

  /*
  |--------------------------------------------------------------------------
  | Unique Role Code
  |--------------------------------------------------------------------------
  |
  | Two roles cannot have the same stable code.
  |
  */

  await queryInterface.addIndex("roles", ["code"], {
    name: "uq_roles_code",
    unique: true,
  });

  /*
  |--------------------------------------------------------------------------
  | Scope Index
  |--------------------------------------------------------------------------
  |
  | Useful later when fetching:
  |
  | platform roles
  | vendor roles
  | customer roles
  |
  */

  await queryInterface.addIndex("roles", ["scope"], {
    name: "idx_roles_scope",
  });

  /*
  |--------------------------------------------------------------------------
  | Active Roles Index
  |--------------------------------------------------------------------------
  */

  await queryInterface.addIndex("roles", ["is_active"], {
    name: "idx_roles_is_active",
  });
}

/*
|--------------------------------------------------------------------------
| Rollback
|--------------------------------------------------------------------------
*/

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable("roles");
}
