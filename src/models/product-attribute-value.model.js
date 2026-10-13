import { DataTypes, Model } from "sequelize";

import { sequelize } from "../config/database.js";

export class ProductAttributeValue extends Model {}

ProductAttributeValue.init(
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

    variantId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: "variant_id",
    },

    attributeId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: "attribute_id",
    },

    attributeValueId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: "attribute_value_id",
    },

    valueText: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "value_text",
    },

    valueDecimal: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: true,
      field: "value_decimal",
    },

    valueBoolean: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      field: "value_boolean",
    },

    unitCode: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: "unit_code",
    },
  },
  {
    sequelize,

    modelName: "ProductAttributeValue",

    tableName: "product_attribute_values",

    timestamps: true,

    createdAt: "created_at",

    updatedAt: "updated_at",

    underscored: true,
  },
);

export default ProductAttributeValue;
