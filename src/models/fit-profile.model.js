import { DataTypes, Model } from "sequelize";

import { sequelize } from "../config/database.js";

export class FitProfile extends Model {}

FitProfile.init(
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
    modelName: "FitProfile",

    tableName: "fit_profiles",

    timestamps: true,

    createdAt: "created_at",

    updatedAt: "updated_at",

    underscored: true,
  },
);

export default FitProfile;
