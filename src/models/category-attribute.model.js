import { DataTypes, Model } from "sequelize";

import { sequelize } from "../config/database.js";

export class CategoryAttribute extends Model {}

CategoryAttribute.init(
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

    attributeId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: "attribute_id",
    },

    isRequired: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "is_required",
    },

    isFilterable: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: "is_filterable",
    },

    isVariantAttribute: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "is_variant_attribute",
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
    modelName: "CategoryAttribute",
    tableName: "category_attributes",

    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",

    underscored: true,
  },
);

export default CategoryAttribute;
