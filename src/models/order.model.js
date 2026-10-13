import { DataTypes, Model } from "sequelize";

import { sequelize } from "../config/database.js";

export class Order extends Model {}

Order.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, autoIncrement: true, primaryKey: true },
    accountId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: "account_id" },
    orderNumber: { type: DataTypes.STRING(32), allowNull: false, unique: true, field: "order_number" },
    status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: "placed", validate: { isIn: [["placed", "confirmed", "packed", "shipped", "outForDelivery", "delivered", "cancelled"]] } },
    deliveredAt: { type: DataTypes.DATE, allowNull: true, field: "delivered_at" },
    cancelledAt: { type: DataTypes.DATE, allowNull: true, field: "cancelled_at" },
    cancelReason: { type: DataTypes.STRING(24), allowNull: true, field: "cancel_reason" },
    cancelNote: { type: DataTypes.STRING(1000), allowNull: true, field: "cancel_note" },
    paymentMode: { type: DataTypes.STRING(20), allowNull: false, field: "payment_mode", validate: { isIn: [["cod", "card"]] } },
    currencyCode: { type: DataTypes.CHAR(3), allowNull: false, defaultValue: "EUR", field: "currency_code" },
    subtotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    discount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    shippingFee: { type: DataTypes.DECIMAL(12, 2), allowNull: false, field: "shipping_fee" },
    codFee: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0, field: "cod_fee" },
    total: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    vatIncluded: { type: DataTypes.DECIMAL(12, 2), allowNull: false, field: "vat_included" },
    shippingMethod: { type: DataTypes.STRING(20), allowNull: false, field: "shipping_method" },
    addressSnapshot: { type: DataTypes.JSON, allowNull: false, field: "address_snapshot" },
  },
  {
    sequelize,
    modelName: "Order",
    tableName: "orders",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    underscored: true,
    indexes: [{ name: "idx_orders_account_created", fields: ["account_id", "created_at"] }],
    hooks: {
      beforeUpdate(order) {
        if (order.changed("status") && order.status === "delivered" && !order.deliveredAt) {
          order.deliveredAt = new Date();
        }
      },
    },
  },
);

export default Order;
