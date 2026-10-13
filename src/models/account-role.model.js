import { DataTypes, Model } from "sequelize";

import { sequelize } from "../config/database.js";

/*
|--------------------------------------------------------------------------
| AccountRole Model
|--------------------------------------------------------------------------
|
| Connects an account with a role.
|
*/

export class AccountRole extends Model {}

/*
|--------------------------------------------------------------------------
| Model Definition
|--------------------------------------------------------------------------
*/

AccountRole.init(
  {
    /*
    |--------------------------------------------------------------------------
    | ID
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
    | Account ID
    |--------------------------------------------------------------------------
    */

    accountId: {
      type: DataTypes.BIGINT.UNSIGNED,

      allowNull: false,

      field: "account_id",

      references: {
        model: "accounts",
        key: "id",
      },
    },

    /*
    |--------------------------------------------------------------------------
    | Role ID
    |--------------------------------------------------------------------------
    */

    roleId: {
      type: DataTypes.BIGINT.UNSIGNED,

      allowNull: false,

      field: "role_id",

      references: {
        model: "roles",
        key: "id",
      },
    },
  },

  {
    sequelize,

    modelName: "AccountRole",

    tableName: "account_roles",

    timestamps: true,

    createdAt: "created_at",

    updatedAt: "updated_at",

    underscored: true,

    indexes: [
      {
        name: "uq_account_roles_account_role",

        unique: true,

        fields: ["account_id", "role_id"],
      },

      {
        name: "idx_account_roles_role_id",

        fields: ["role_id"],
      },
    ],
  },
);

export default AccountRole;
