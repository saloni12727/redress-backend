import { DataTypes, Model } from "sequelize";

import { sequelize } from "../config/database.js";

/*
 * Guest sessions are intentionally modelled even though the guest module uses
 * focused SQL queries for token rotation and row locking. This keeps the
 * model-first development schema aligned with the guest-session table.
 */
export class GuestSession extends Model {}

GuestSession.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    sessionUuid: {
      type: DataTypes.CHAR(36),
      allowNull: false,
      unique: true,
      field: "session_uuid",
    },
    installationIdHash: {
      type: DataTypes.CHAR(64),
      allowNull: false,
      field: "installation_id_hash",
    },
    tokenVersion: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 1,
      field: "token_version",
    },
    platform: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    appVersion: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: "app_version",
    },
    locale: {
      type: DataTypes.STRING(5),
      allowNull: false,
      defaultValue: "it",
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "active",
    },
    convertedAccountId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: "converted_account_id",
    },
    lastSeenAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "last_seen_at",
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "expires_at",
    },
  },
  {
    sequelize,
    modelName: "GuestSession",
    tableName: "guest_sessions",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    underscored: true,
    indexes: [
      {
        name: "uq_guest_sessions_session_uuid",
        unique: true,
        fields: ["session_uuid"],
      },
      {
        name: "idx_guest_sessions_installation",
        fields: ["installation_id_hash", "platform", "status"],
      },
      {
        name: "idx_guest_sessions_converted_account",
        fields: ["converted_account_id"],
      },
      {
        name: "idx_guest_sessions_expires_at",
        fields: ["expires_at"],
      },
    ],
  },
);

export default GuestSession;
