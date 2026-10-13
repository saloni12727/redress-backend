import { DataTypes, Model } from "sequelize";

import { sequelize } from "../config/database.js";

/*
|--------------------------------------------------------------------------
| RolePermission Model
|--------------------------------------------------------------------------
|
| Connects a Role with a Permission.
|
*/

export class RolePermission extends Model {}

/*
|--------------------------------------------------------------------------
| Model Definition
|--------------------------------------------------------------------------
*/

RolePermission.init(
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

    /*
    |--------------------------------------------------------------------------
    | Permission ID
    |--------------------------------------------------------------------------
    */

    permissionId: {
      type: DataTypes.BIGINT.UNSIGNED,

      allowNull: false,

      field: "permission_id",

      references: {
        model: "permissions",
        key: "id",
      },
    },
  },

  {
    sequelize,

    modelName: "RolePermission",

    tableName: "role_permissions",

    timestamps: true,

    createdAt: "created_at",

    updatedAt: "updated_at",

    underscored: true,

    indexes: [
      {
        name: "uq_role_permissions_role_permission",

        unique: true,

        fields: ["role_id", "permission_id"],
      },

      {
        name: "idx_role_permissions_permission_id",

        fields: ["permission_id"],
      },
    ],
  },
);

export default RolePermission;
