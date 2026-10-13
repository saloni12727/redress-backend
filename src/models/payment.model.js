import { DataTypes, Model } from "sequelize";

import { sequelize } from "../config/database.js";

export class Payment extends Model {}

Payment.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, autoIncrement: true, primaryKey: true },
    orderId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, unique: true, field: "order_id" },
    mode: { type: DataTypes.STRING(20), allowNull: false, validate: { isIn: [["cod", "card"]] } },
    provider: { type: DataTypes.STRING(40), allowNull: false },
    status: { type: DataTypes.STRING(20), allowNull: false, validate: { isIn: [["pending", "paid", "unpaid", "failed"]] } },
    providerPaymentId: { type: DataTypes.STRING(191), allowNull: true, unique: true, field: "provider_payment_id" },
  },
  { sequelize, modelName: "Payment", tableName: "payments", timestamps: true, createdAt: "created_at", updatedAt: "updated_at", underscored: true },
);

export default Payment;
