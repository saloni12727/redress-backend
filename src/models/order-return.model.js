import { DataTypes, Model } from "sequelize";

import { sequelize } from "../config/database.js";

export class OrderReturn extends Model {}

OrderReturn.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    orderId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: "order_id",
    },
    accountId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: "account_id",
    },
    status: {
      type: DataTypes.STRING(24),
      allowNull: false,
      defaultValue: "requested",
      validate: { isIn: [["requested", "approved", "inTransit", "received", "refundPending", "refunded", "rejected", "cancelled"]] },
    },
    refundStatus: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "not_started",
      field: "refund_status",
      validate: { isIn: [["not_started", "pending", "manual", "refunded"]] },
    },
    refundMethod: { type: DataTypes.STRING(32), allowNull: true, field: "refund_method" },
    refundProvider: { type: DataTypes.STRING(40), allowNull: true, field: "refund_provider" },
    providerRefundId: { type: DataTypes.STRING(191), allowNull: true, field: "provider_refund_id" },
  },
  {
    sequelize,
    modelName: "OrderReturn",
    tableName: "order_returns",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    underscored: true,
    indexes: [
      { name: "idx_order_returns_order", fields: ["order_id"] },
      { name: "idx_order_returns_account_created", fields: ["account_id", "created_at"] },
    ],
  },
);

export default OrderReturn;
