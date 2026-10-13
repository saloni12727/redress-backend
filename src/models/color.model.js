import { DataTypes, Model } from "sequelize";

import { sequelize } from "../config/database.js";

export class Color extends Model {}

Color.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },

    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    hexCode: {
      type: DataTypes.STRING(7),
      allowNull: true,
      field: "hex_code",
    },

    sortOrder: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: "sort_order",
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
    modelName: "Color",
    tableName: "colors",

    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",

    underscored: true,
  },
);

export default Color;
