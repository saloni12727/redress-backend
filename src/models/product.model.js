import { DataTypes, Model } from "sequelize";

import { sequelize } from "../config/database.js";

export class Product extends Model {}

Product.init(
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

    brandId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: "brand_id",
    },

    fitProfileId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: "fit_profile_id",
    },

    code: {
      type: DataTypes.STRING(120),
      allowNull: false,
      unique: true,
    },

    slug: {
      type: DataTypes.STRING(180),
      allowNull: false,
      unique: true,
    },

    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "draft",
      validate: {
        isIn: [["draft", "published", "archived"]],
      },
    },

    approvalStatus: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "draft",
      field: "approval_status",
      validate: {
        isIn: [["draft", "pending", "approved", "rejected"]],
      },
    },

    visibility: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "hidden",
      validate: {
        isIn: [["public", "hidden"]],
      },
    },

    currencyCode: {
      type: DataTypes.CHAR(3),
      allowNull: false,
      field: "currency_code",
    },

    isFeatured: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "is_featured",
    },

    tryOnReady: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "try_on_ready",
    },

    isReturnable: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: "is_returnable",
    },

    returnWindowDays: {
      type: DataTypes.SMALLINT.UNSIGNED,
      allowNull: true,
      defaultValue: 14,
      field: "return_window_days",
      validate: {
        is: /^(14)$/,
      },
    },

    rejectionReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "rejection_reason",
    },

    publishedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "published_at",
    },

    approvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "approved_at",
    },

    createdByAccountId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: "created_by_account_id",
    },

    approvedByAccountId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: "approved_by_account_id",
    },
  },
  {
    sequelize,
    modelName: "Product",
    tableName: "products",
    timestamps: true,
    paranoid: true,
    underscored: true,
  },
);

export default Product;
