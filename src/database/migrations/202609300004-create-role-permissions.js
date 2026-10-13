import { DataTypes } from "sequelize";

/*
|--------------------------------------------------------------------------
| Create Role Permissions Table
|--------------------------------------------------------------------------
|
| This is the junction table between:
|
| roles
|   ↓
| role_permissions
|   ↓
| permissions
|
| Example:
|
| super_admin
|   +
| platform.products.view
|
*/

export async function up({ context: queryInterface }) {
  await queryInterface.createTable("role_permissions", {
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
      onDelete: "CASCADE",
    },

    /*
      |--------------------------------------------------------------------------
      | Permission
      |--------------------------------------------------------------------------
      */

    permission_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,

      references: {
        model: "permissions",
        key: "id",
      },

      onUpdate: "CASCADE",
      onDelete: "CASCADE",
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
  | Unique Role + Permission Pair
  |--------------------------------------------------------------------------
  |
  | Same permission cannot be assigned twice
  | to the same role.
  |
  | Example:
  |
  | admin + platform.products.view
  |
  | can exist only once.
  |
  */

  await queryInterface.addIndex(
    "role_permissions",
    ["role_id", "permission_id"],
    {
      name: "uq_role_permissions_role_permission",

      unique: true,
    },
  );

  /*
  |--------------------------------------------------------------------------
  | Permission Index
  |--------------------------------------------------------------------------
  |
  | The unique index above already starts with role_id,
  | so role-based lookup is covered.
  |
  | This additional index helps reverse lookup:
  |
  | "Which roles have this permission?"
  |
  */

  await queryInterface.addIndex("role_permissions", ["permission_id"], {
    name: "idx_role_permissions_permission_id",
  });
}

/*
|--------------------------------------------------------------------------
| Rollback
|--------------------------------------------------------------------------
*/

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable("role_permissions");
}
