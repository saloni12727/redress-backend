import { DataTypes, Model } from "sequelize";

import { sequelize } from "../config/database.js";

export class OrderFulfillment extends Model {}

OrderFulfillment.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, autoIncrement: true, primaryKey: true },
    orderId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, unique: true, field: "order_id" },
    carrier: { type: DataTypes.STRING(120), allowNull: false },
    trackingNumber: { type: DataTypes.STRING(191), allowNull: false, field: "tracking_number" },
    trackingUrl: { type: DataTypes.STRING(2048), allowNull: true, field: "tracking_url" },
    shippedAt: { type: DataTypes.DATE, allowNull: true, field: "shipped_at" },
  },
  {
    sequelize,
    modelName: "OrderFulfillment",
    tableName: "order_fulfillments",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    underscored: true,
  },
);

export default OrderFulfillment;
