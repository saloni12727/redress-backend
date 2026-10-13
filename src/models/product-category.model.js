import { DataTypes, Model } from "sequelize";

import { sequelize } from "../config/database.js";

export class ProductCategory extends Model {}

ProductCategory.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    productId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: "product_id",
    },

    categoryId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: "category_id",
    },

    isPrimary: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "is_primary",
    },

    sortOrder: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: "sort_order",
    },
  },
  {
    sequelize,
    modelName: "ProductCategory",
    tableName: "product_categories",

    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",

    underscored: true,
  },
);

export default ProductCategory;
