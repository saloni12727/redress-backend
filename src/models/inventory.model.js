import { DataTypes, Model } from "sequelize";

import { sequelize } from "../config/database.js";

export class Inventory extends Model {}

Inventory.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    variantId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      unique: true,
      field: "variant_id",
    },

    quantityOnHand: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: "quantity_on_hand",
    },

    quantityReserved: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: "quantity_reserved",
    },

    reorderPoint: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: "reorder_point",
    },

    safetyStock: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: "safety_stock",
    },

    allowBackorder: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "allow_backorder",
    },

    stockVersion: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: "stock_version",
    },
  },
  {
    sequelize,
    modelName: "Inventory",
    tableName: "inventory",

    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",

    underscored: true,
  },
);

export default Inventory;
