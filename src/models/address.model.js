import { DataTypes, Model } from "sequelize";

import { sequelize } from "../config/database.js";

export class Address extends Model {}

Address.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, autoIncrement: true, primaryKey: true },
    accountId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: "account_id" },
    label: { type: DataTypes.STRING(50), allowNull: false },
    fullName: { type: DataTypes.STRING(120), allowNull: false, field: "full_name" },
    phone: { type: DataTypes.STRING(20), allowNull: false },
    line1: { type: DataTypes.STRING(200), allowNull: false },
    line2: { type: DataTypes.STRING(200), allowNull: true },
    city: { type: DataTypes.STRING(100), allowNull: false },
    state: { type: DataTypes.STRING(100), allowNull: true },
    postalCode: { type: DataTypes.STRING(20), allowNull: false, field: "postal_code" },
    country: { type: DataTypes.CHAR(2), allowNull: false, defaultValue: "IT" },
    isDefault: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: "is_default" },
  },
  {
    sequelize, modelName: "Address", tableName: "addresses", timestamps: true, createdAt: "created_at", updatedAt: "updated_at", paranoid: true, deletedAt: "deleted_at", underscored: true,
    indexes: [{ name: "idx_addresses_account_default", fields: ["account_id", "is_default"] }],
  },
);

export default Address;
