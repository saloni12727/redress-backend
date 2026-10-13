import { DataTypes, Model } from "sequelize";

import { sequelize } from "../config/database.js";

export class ShopperMedia extends Model {}

ShopperMedia.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    accountId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: "account_id",
    },

    purpose: {
      type: DataTypes.STRING(32),
      allowNull: false,
      validate: {
        isIn: [["bodyPhoto"]],
      },
    },

    storageKey: {
      type: DataTypes.STRING(500),
      allowNull: false,
      field: "storage_key",
      unique: true,
    },

    mimeType: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: "mime_type",
    },

    width: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },

    height: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },

    sizeBytes: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field: "size_bytes",
    },

    attachedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "attached_at",
    },
  },
  {
    sequelize,

    modelName: "ShopperMedia",

    tableName: "shopper_media",

    timestamps: true,

    paranoid: true,

    underscored: true,

    indexes: [
      {
        fields: ["account_id", "purpose", "attached_at"],
        name: "idx_shopper_media_owner_purpose_attachment",
      },

      {
        fields: ["created_at"],
        name: "idx_shopper_media_created",
      },
    ],
  },
);

export default ShopperMedia;
