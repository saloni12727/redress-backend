import { DataTypes, Model } from "sequelize";

import { sequelize } from "../config/database.js";

export class Vendor extends Model {}

Vendor.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    code: {
      type: DataTypes.STRING(80),
      allowNull: false,
      unique: true,
    },

    slug: {
      type: DataTypes.STRING(160),
      allowNull: false,
      unique: true,
    },

    displayName: {
      type: DataTypes.STRING(180),
      allowNull: false,
      field: "display_name",
    },

    legalName: {
      type: DataTypes.STRING(220),
      allowNull: true,
      field: "legal_name",
    },

    email: {
      type: DataTypes.STRING(191),
      allowNull: true,
      unique: true,
      validate: {
        isEmail: true,
      },
    },

    phone: {
      type: DataTypes.STRING(40),
      allowNull: true,
    },

    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "inactive",
      validate: {
        isIn: [["active", "inactive", "suspended"]],
      },
    },

    approvalStatus: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "pending",
      field: "approval_status",
      validate: {
        isIn: [["pending", "approved", "rejected"]],
      },
    },

    commissionType: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "percentage",
      field: "commission_type",
      validate: {
        isIn: [["percentage", "fixed"]],
      },
    },

    commissionValue: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      field: "commission_value",
    },

    defaultCurrencyCode: {
      type: DataTypes.CHAR(3),
      allowNull: false,
      field: "default_currency_code",
    },

    countryCode: {
      type: DataTypes.CHAR(2),
      allowNull: true,
      field: "country_code",
    },

    taxIdentifier: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "tax_identifier",
    },

    registrationNumber: {
      type: DataTypes.STRING(120),
      allowNull: true,
      field: "registration_number",
    },

    websiteUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: "website_url",
    },

    logoKey: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: "logo_key",
    },

    approvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "approved_at",
    },

    rejectionReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "rejection_reason",
    },

    suspendedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "suspended_at",
    },
  },
  {
    sequelize,
    modelName: "Vendor",
    tableName: "vendors",

    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",

    paranoid: true,
    deletedAt: "deleted_at",

    underscored: true,
  },
);

export default Vendor;
