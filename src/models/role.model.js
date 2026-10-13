import { DataTypes, Model } from "sequelize";

import { sequelize } from "../config/database.js";

/*
|--------------------------------------------------------------------------
| Role Model
|--------------------------------------------------------------------------
|
| Represents the "roles" database table
| inside the Node.js application.
|
*/

export class Role extends Model {}

/*
|--------------------------------------------------------------------------
| Model Definition
|--------------------------------------------------------------------------
*/

Role.init(
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
    | Stable Role Code
    |--------------------------------------------------------------------------
    */

    code: {
      type: DataTypes.STRING(80),

      allowNull: false,

      unique: true,

      validate: {
        notEmpty: true,

        len: [2, 80],

        is: /^[a-z][a-z0-9_]*$/,
      },
    },

    /*
    |--------------------------------------------------------------------------
    | Display Name
    |--------------------------------------------------------------------------
    */

    name: {
      type: DataTypes.STRING(120),

      allowNull: false,

      validate: {
        notEmpty: true,

        len: [2, 120],
      },
    },

    /*
    |--------------------------------------------------------------------------
    | Scope
    |--------------------------------------------------------------------------
    */

    scope: {
      type: DataTypes.STRING(32),

      allowNull: false,

      validate: {
        isIn: [["platform", "vendor", "customer"]],
      },
    },

    /*
    |--------------------------------------------------------------------------
    | System Role
    |--------------------------------------------------------------------------
    */

    isSystem: {
      type: DataTypes.BOOLEAN,

      allowNull: false,

      defaultValue: false,

      field: "is_system",
    },

    /*
    |--------------------------------------------------------------------------
    | Active Status
    |--------------------------------------------------------------------------
    */

    isActive: {
      type: DataTypes.BOOLEAN,

      allowNull: false,

      defaultValue: true,

      field: "is_active",
    },
  },

  {
    sequelize,

    modelName: "Role",

    tableName: "roles",

    /*
    |--------------------------------------------------------------------------
    | Timestamp Handling
    |--------------------------------------------------------------------------
    */

    timestamps: true,

    createdAt: "created_at",

    updatedAt: "updated_at",

    /*
    |--------------------------------------------------------------------------
    | Soft Delete
    |--------------------------------------------------------------------------
    */

    paranoid: true,

    deletedAt: "deleted_at",

    /*
    |--------------------------------------------------------------------------
    | Database naming convention
    |--------------------------------------------------------------------------
    */

    underscored: true,
  },
);

export default Role;
