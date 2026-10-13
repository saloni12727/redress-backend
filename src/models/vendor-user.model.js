import { DataTypes, Model } from "sequelize";

import { sequelize } from "../config/database.js";

export class VendorUser extends Model {}

VendorUser.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    vendorId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: "vendor_id",
    },

    accountId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: "account_id",
    },

    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "active",
      validate: {
        isIn: [["active", "inactive"]],
      },
    },

    isOwner: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "is_owner",
    },

    joinedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "joined_at",
    },
  },
  {
    sequelize,
    modelName: "VendorUser",
    tableName: "vendor_users",

    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",

    underscored: true,
  },
);

export default VendorUser;
