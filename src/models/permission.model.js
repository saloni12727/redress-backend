import { DataTypes, Model } from "sequelize";

import { sequelize } from "../config/database.js";

/*
|--------------------------------------------------------------------------
| Permission Model
|--------------------------------------------------------------------------
|
| Represents the "permissions" table inside Node.js.
|
*/

export class Permission extends Model {}

/*
|--------------------------------------------------------------------------
| Model Definition
|--------------------------------------------------------------------------
*/

Permission.init(
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
    | Stable Permission Code
    |--------------------------------------------------------------------------
    */

    code: {
      type: DataTypes.STRING(150),

      allowNull: false,

      unique: true,

      validate: {
        notEmpty: true,

        len: [5, 150],

        /*
         * Example:
         *
         * platform.products.view
         * vendor.orders.update
         */

        is: /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){2,}$/,
      },
    },

    /*
    |--------------------------------------------------------------------------
    | Module
    |--------------------------------------------------------------------------
    */

    module: {
      type: DataTypes.STRING(64),

      allowNull: false,

      validate: {
        notEmpty: true,

        len: [2, 64],

        is: /^[a-z][a-z0-9_]*$/,
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
    | Description
    |--------------------------------------------------------------------------
    */

    description: {
      type: DataTypes.STRING(255),

      allowNull: false,

      validate: {
        notEmpty: true,

        len: [3, 255],
      },
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

    modelName: "Permission",

    tableName: "permissions",

    timestamps: true,

    createdAt: "created_at",

    updatedAt: "updated_at",

    underscored: true,
  },
);

export default Permission;
