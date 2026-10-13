import { DataTypes, Model } from "sequelize";

import { sequelize } from "../config/database.js";

export class CategoryMeasurementRequirement extends Model {}

CategoryMeasurementRequirement.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    categoryId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: "category_id",
    },

    measurementTypeId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: "measurement_type_id",
    },

    isRequired: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: "is_required",
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

    modelName: "CategoryMeasurementRequirement",

    tableName: "category_measurement_requirements",

    timestamps: true,

    createdAt: "created_at",

    updatedAt: "updated_at",

    underscored: true,
  },
);

export default CategoryMeasurementRequirement;
