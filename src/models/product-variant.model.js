import { DataTypes, Model } from "sequelize";

import { sequelize } from "../config/database.js";

export class ProductVariant extends Model {}

ProductVariant.init(
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

    sizeId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: "size_id",
    },

    colorId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: "color_id",
    },

    sku: {
      type: DataTypes.STRING(160),
      allowNull: false,
      unique: true,
    },

    barcode: {
      type: DataTypes.STRING(80),
      allowNull: true,
      unique: true,
    },

    regularPrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      field: "regular_price",
    },

    salePrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      field: "sale_price",
    },

    costPrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      field: "cost_price",
    },

    saleStartAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "sale_start_at",
    },

    saleEndAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "sale_end_at",
    },

    weightValue: {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: true,
      field: "weight_value",
    },

    weightUnit: {
      type: DataTypes.STRING(10),
      allowNull: true,
      field: "weight_unit",
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

    sortOrder: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: "sort_order",
    },
  },
  {
    sequelize,
    modelName: "ProductVariant",
    tableName: "product_variants",

    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",

    paranoid: true,
    deletedAt: "deleted_at",

    underscored: true,
  },
);

export default ProductVariant;
