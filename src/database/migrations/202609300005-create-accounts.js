import { DataTypes } from "sequelize";

/*
|--------------------------------------------------------------------------
| Create Accounts Table
|--------------------------------------------------------------------------
|
| "accounts" stores the login identity of Redress users.
|
| Examples:
|
| Super Admin
| Admin
| Vendor Owner
| Vendor Staff
| Customer
|
| Role information is NOT stored directly here.
| Roles are linked separately through account_roles.
|
*/

export async function up({ context: queryInterface }) {
  await queryInterface.createTable("accounts", {
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
      | Email
      |--------------------------------------------------------------------------
      |
      | Main login identifier.
      |
      */

    email: {
      type: DataTypes.STRING(191),
      allowNull: false,
    },

    /*
      |--------------------------------------------------------------------------
      | Password Hash
      |--------------------------------------------------------------------------
      |
      | IMPORTANT:
      |
      | Plain password is NEVER stored here.
      |
      | Example:
      |
      | User enters:
      | MyPassword123
      |
      | Database stores:
      | $2b$12$...
      |
      */

    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },

    /*
      |--------------------------------------------------------------------------
      | Name
      |--------------------------------------------------------------------------
      */

    first_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    /*
     * last_name is nullable because some users
     * may have only one legal/display name.
     */

    last_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    /*
      |--------------------------------------------------------------------------
      | Account Status
      |--------------------------------------------------------------------------
      |
      | Initial values we will use:
      |
      | active
      | inactive
      | suspended
      |
      | We keep this as STRING instead of DB ENUM
      | so future statuses can be added through
      | application rules without difficult ENUM changes.
      |
      */

    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "active",
    },

    /*
      |--------------------------------------------------------------------------
      | Email Verification
      |--------------------------------------------------------------------------
      |
      | null:
      | email not verified
      |
      | date:
      | email verified at that time
      |
      */

    email_verified_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    /*
      |--------------------------------------------------------------------------
      | Last Login
      |--------------------------------------------------------------------------
      */

    last_login_at: {
      type: DataTypes.DATE,
      allowNull: true,
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
  | Unique Email
  |--------------------------------------------------------------------------
  |
  | Same email cannot create two login identities.
  |
  */

  await queryInterface.addIndex("accounts", ["email"], {
    name: "uq_accounts_email",
    unique: true,
  });

  /*
  |--------------------------------------------------------------------------
  | Status Index
  |--------------------------------------------------------------------------
  |
  | Useful when filtering:
  |
  | active users
  | suspended users
  |
  */

  await queryInterface.addIndex("accounts", ["status"], {
    name: "idx_accounts_status",
  });
}

/*
|--------------------------------------------------------------------------
| Rollback
|--------------------------------------------------------------------------
*/

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable("accounts");
}
