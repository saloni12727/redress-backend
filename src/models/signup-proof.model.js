import { DataTypes, Model } from "sequelize";

import { sequelize } from "../config/database.js";

/* Durable one-time record for a Google signup JWT. OTP signup JWTs continue
 * to be consumed through auth_otp_challenges. */
export class SignupProof extends Model {}

SignupProof.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, autoIncrement: true, primaryKey: true },
    proofUuid: { type: DataTypes.CHAR(36), allowNull: false, unique: true, field: "proof_uuid" },
    type: { type: DataTypes.STRING(32), allowNull: false },
    subject: { type: DataTypes.STRING(191), allowNull: false },
    email: { type: DataTypes.STRING(191), allowNull: true },
    displayName: { type: DataTypes.STRING(200), allowNull: true, field: "display_name" },
    photoUrl: { type: DataTypes.STRING(500), allowNull: true, field: "photo_url" },
    tokenHash: { type: DataTypes.CHAR(64), allowNull: false, field: "token_hash" },
    tokenJti: { type: DataTypes.CHAR(36), allowNull: false, field: "token_jti" },
    consumedAt: { type: DataTypes.DATE, allowNull: true, field: "consumed_at" },
    expiresAt: { type: DataTypes.DATE, allowNull: false, field: "expires_at" },
  },
  {
    sequelize,
    modelName: "SignupProof",
    tableName: "signup_proofs",
    timestamps: true,
    updatedAt: "updated_at",
    createdAt: "created_at",
    underscored: true,
    indexes: [
      { fields: ["type", "subject", "expires_at"], name: "idx_signup_proofs_subject" },
      { fields: ["expires_at"], name: "idx_signup_proofs_expiry" },
    ],
  },
);

export default SignupProof;
