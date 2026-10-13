import { DataTypes, Model } from "sequelize";

import { sequelize } from "../config/database.js";

export class UserConsent extends Model {}

UserConsent.init(
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

    kind: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "privacy",
    },

    version: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },

    acceptedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "accepted_at",
    },

    channel: {
      type: DataTypes.STRING(32),
      allowNull: false,
      validate: {
        isIn: [["phone", "email", "google", "app_reconsent"]],
      },
    },
  },
  {
    sequelize,

    modelName: "UserConsent",

    tableName: "user_consents",

    timestamps: true,

    /*
     * user_consents is append-only.
     * Only createdAt is stored.
     */

    updatedAt: false,

    underscored: true,

    indexes: [
      {
        fields: ["account_id", "kind", "accepted_at"],
        name: "idx_user_consents_account_kind",
      },
    ],
  },
);

export default UserConsent;
