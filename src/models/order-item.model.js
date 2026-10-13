import { DataTypes, Model } from "sequelize";

import { sequelize } from "../config/database.js";

export class OrderItem extends Model {}

OrderItem.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, autoIncrement: true, primaryKey: true },
    orderId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: "order_id" },
    productId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: "product_id" },
    productVariantId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, field: "product_variant_id" },
    productSnapshot: { type: DataTypes.JSON, allowNull: false, field: "product_snapshot" },
    quantity: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false },
    unitPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: false, field: "unit_price" },
    regularPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: false, field: "regular_price" },
    lineTotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, field: "line_total" },
  },
  { sequelize, modelName: "OrderItem", tableName: "order_items", timestamps: true, createdAt: "created_at", updatedAt: "updated_at", underscored: true, indexes: [{ name: "idx_order_items_order", fields: ["order_id"] }] },
);

export default OrderItem;
