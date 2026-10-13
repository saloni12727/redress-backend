import { DataTypes, Model } from "sequelize";

import { sequelize } from "../config/database.js";

export class OrderReturnItem extends Model {}

OrderReturnItem.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    orderReturnId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: "order_return_id",
    },
    orderItemId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: "order_item_id",
    },
    productSnapshot: {
      type: DataTypes.JSON,
      allowNull: false,
      field: "product_snapshot",
    },
    quantity: {
      type: DataTypes.SMALLINT.UNSIGNED,
      allowNull: false,
    },
    reason: {
      type: DataTypes.STRING(24),
      allowNull: false,
      validate: { isIn: [["sizeFit", "quality", "notAsDescribed", "changedMind", "damaged", "other"]] },
    },
    note: {
      type: DataTypes.STRING(1000),
      allowNull: true,
    },
    unitPrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      field: "unit_price",
    },
    lineTotal: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      field: "line_total",
    },
  },
  {
    sequelize,
    modelName: "OrderReturnItem",
    tableName: "order_return_items",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    underscored: true,
    indexes: [
      { name: "idx_order_return_items_return", fields: ["order_return_id"] },
      { name: "idx_order_return_items_order_item", fields: ["order_item_id"] },
    ],
  },
);

export default OrderReturnItem;
