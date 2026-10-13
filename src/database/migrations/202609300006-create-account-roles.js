import { DataTypes } from "sequelize";

/*
|--------------------------------------------------------------------------
| Create Account Roles Table
|--------------------------------------------------------------------------
|
| Connects:
|
| Account
|    ↓
| AccountRole
|    ↓
| Role
|
| Example:
|
| admin@redress.com
|    ↓
| super_admin
|
*/

export async function up({ context: queryInterface }) {
  await queryInterface.createTable("account_roles", {
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
      | Account
      |--------------------------------------------------------------------------
      */

    account_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,

      references: {
        model: "accounts",
        key: "id",
      },

      onUpdate: "CASCADE",

      /*
       * If an account is ever physically deleted,
       * its role mappings must also disappear.
       */

      onDelete: "CASCADE",
    },

    /*
      |--------------------------------------------------------------------------
      | Role
      |--------------------------------------------------------------------------
      */

    role_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,

      references: {
        model: "roles",
        key: "id",
      },

      onUpdate: "CASCADE",

      /*
       * Assigned roles should not be physically
       * deleted accidentally.
       *
       * Custom roles will normally use soft delete.
       */

      onDelete: "RESTRICT",
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
  | Unique Account + Role
  |--------------------------------------------------------------------------
  |
  | Same role cannot be assigned twice
  | to the same account.
  |
  */

  await queryInterface.addIndex("account_roles", ["account_id", "role_id"], {
    name: "uq_account_roles_account_role",

    unique: true,
  });

  /*
  |--------------------------------------------------------------------------
  | Role Index
  |--------------------------------------------------------------------------
  |
  | Useful for queries:
  |
  | "Show all accounts having admin role."
  |
  */

  await queryInterface.addIndex("account_roles", ["role_id"], {
    name: "idx_account_roles_role_id",
  });
}

/*
|--------------------------------------------------------------------------
| Rollback
|--------------------------------------------------------------------------
*/

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable("account_roles");
}
