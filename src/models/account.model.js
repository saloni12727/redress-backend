import { DataTypes, Model } from "sequelize";

import { sequelize } from "../config/database.js";

export class Account extends Model {}

Account.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    email: {
      type: DataTypes.STRING(191),
      allowNull: true,
      unique: true,
      validate: {
        isEmail: true,
      },
      set(value) {
        this.setDataValue(
          "email",
          typeof value === "string" ? value.trim().toLowerCase() : null,
        );
      },
    },

    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "password_hash",
    },

    firstName: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "first_name",
      validate: {
        len: [1, 100],
      },
    },

    lastName: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "last_name",
      validate: {
        len: [1, 100],
      },
    },

    displayName: {
      type: DataTypes.STRING(200),
      allowNull: true,
      field: "display_name",
      validate: {
        len: [1, 200],
      },
    },

    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      unique: true,
      validate: {
        is: /^\+[1-9]\d{7,14}$/,
      },
    },

    phoneVerifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "phone_verified_at",
    },

    photoUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: "photo_url",
      validate: {
        isUrl: true,
      },
    },

    profilePhotoStorageKey: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: "profile_photo_storage_key",
    },

    consentPrivacyAcceptedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "consent_privacy_accepted_at",
    },

    consentPrivacyVersion: {
      type: DataTypes.STRING(64),
      allowNull: true,
      field: "consent_privacy_version",
    },

    consentChannel: {
      type: DataTypes.STRING(32),
      allowNull: true,
      field: "consent_channel",
      validate: {
        isIn: [["phone", "email", "google", "app_reconsent"]],
      },
    },

    fitSetupSkippedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "fit_setup_skipped_at",
    },

    locale: {
      type: DataTypes.STRING(5),
      allowNull: false,
      defaultValue: "it",
      validate: {
        isIn: [["it", "en"]],
      },
    },

    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "active",
      validate: {
        isIn: [["active", "inactive", "suspended"]],
      },
    },

    emailVerifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "email_verified_at",
    },

    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "last_login_at",
    },
  },
  {
    sequelize,
    modelName: "Account",
    tableName: "accounts",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    underscored: true,

    /* Never expose password hash accidentally. */
    defaultScope: {
      attributes: {
        exclude: ["passwordHash"],
      },
    },

    scopes: {
      withPassword: {
        attributes: {
          include: ["passwordHash"],
        },
      },
    },
  },
);

export default Account;
