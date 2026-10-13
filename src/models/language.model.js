import { DataTypes, Model } from "sequelize";

import { sequelize } from "../config/database.js";

/*
|--------------------------------------------------------------------------
| Language Model
|--------------------------------------------------------------------------
|
| Represents the "languages" database table inside Node.js.
|
*/

export class Language extends Model {}

/*
|--------------------------------------------------------------------------
| Model Definition
|--------------------------------------------------------------------------
*/

Language.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,

      allowNull: false,

      autoIncrement: true,

      primaryKey: true,
    },

    code: {
      type: DataTypes.STRING(10),

      allowNull: false,

      unique: true,

      validate: {
        notEmpty: true,

        len: [2, 10],
      },
    },

    name: {
      type: DataTypes.STRING(100),

      allowNull: false,

      validate: {
        notEmpty: true,

        len: [2, 100],
      },
    },

    isDefault: {
      type: DataTypes.BOOLEAN,

      allowNull: false,

      defaultValue: false,

      field: "is_default",
    },

    isActive: {
      type: DataTypes.BOOLEAN,

      allowNull: false,

      defaultValue: true,

      field: "is_active",
    },
  },

  {
    sequelize,

    modelName: "Language",

    tableName: "languages",

    timestamps: true,

    underscored: true,
  },
);

export default Language;
