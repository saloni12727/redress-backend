import { DataTypes, Model } from "sequelize";

import { sequelize } from "../config/database.js";

export class ProductMedia extends Model {}

ProductMedia.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    productId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: "product_id",
    },

    variantId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: "variant_id",
    },

    mediaType: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "image",
      field: "media_type",
      validate: {
        isIn: [["image", "video"]],
      },
    },

    storageKey: {
      type: DataTypes.STRING(500),
      allowNull: false,
      field: "storage_key",
    },

    mimeType: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "mime_type",
    },

    altText: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "alt_text",
    },

    width: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },

    height: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },

    durationSeconds: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: "duration_seconds",
    },

    sortOrder: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: "sort_order",
    },

    isPrimary: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "is_primary",
    },

    moderationStatus: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "pending",
      field: "moderation_status",
      validate: {
        isIn: [["pending", "approved", "rejected"]],
      },
    },

    approvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "approved_at",
    },
  },
  {
    sequelize,
    modelName: "ProductMedia",
    tableName: "product_media",

    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",

    paranoid: true,
    deletedAt: "deleted_at",

    underscored: true,
  },
);

export default ProductMedia;
