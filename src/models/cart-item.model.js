import { DataTypes, Model } from "sequelize";

import { sequelize } from "../config/database.js";

export class CartItem extends Model {}

CartItem.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, autoIncrement: true, primaryKey: true },
    cartId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: "cart_id" },
    productVariantId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: "product_variant_id" },
    quantity: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false, defaultValue: 1 },
  },
  {
    sequelize, modelName: "CartItem", tableName: "cart_items", timestamps: true, createdAt: "created_at", updatedAt: "updated_at", underscored: true,
    indexes: [{ name: "uq_cart_items_cart_variant", unique: true, fields: ["cart_id", "product_variant_id"] }],
  },
);

export default CartItem;
