import { DataTypes } from "sequelize";

export async function up({ context: queryInterface }) {
  await queryInterface.createTable("auth_otp_challenges", {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,

      allowNull: false,

      autoIncrement: true,

      primaryKey: true,
    },

    challenge_uuid: {
      type: DataTypes.CHAR(36),

      allowNull: false,
    },

    phone: {
      type: DataTypes.STRING(20),

      allowNull: false,
    },

    /*
     * OTP itself is NEVER stored.
     *
     * We store keyed SHA-256 HMAC only.
     */
    code_hash: {
      type: DataTypes.CHAR(64),

      allowNull: false,
    },

    attempts: {
      type: DataTypes.SMALLINT.UNSIGNED,

      allowNull: false,

      defaultValue: 0,
    },

    max_attempts: {
      type: DataTypes.SMALLINT.UNSIGNED,

      allowNull: false,

      defaultValue: 5,
    },

    /*
     * pending
     * verified
     * consumed
     * expired
     * locked
     * superseded
     * delivery_failed
     */
    status: {
      type: DataTypes.STRING(24),

      allowNull: false,

      defaultValue: "pending",
    },

    locale: {
      type: DataTypes.STRING(5),

      allowNull: false,

      defaultValue: "it",
    },

    /*
     * signupToken is one-time.
     *
     * Raw token is never stored.
     */
    signup_token_hash: {
      type: DataTypes.CHAR(64),

      allowNull: true,
    },

    signup_jti: {
      type: DataTypes.CHAR(36),

      allowNull: true,
    },

    signup_expires_at: {
      type: DataTypes.DATE,

      allowNull: true,
    },

    verified_at: {
      type: DataTypes.DATE,

      allowNull: true,
    },

    consumed_at: {
      type: DataTypes.DATE,

      allowNull: true,
    },

    expires_at: {
      type: DataTypes.DATE,

      allowNull: false,
    },

    created_at: {
      type: DataTypes.DATE,

      allowNull: false,
    },

    updated_at: {
      type: DataTypes.DATE,

      allowNull: false,
    },
  });

  await queryInterface.addIndex("auth_otp_challenges", ["challenge_uuid"], {
    name: "uq_auth_otp_challenges_uuid",

    unique: true,
  });

  await queryInterface.addIndex(
    "auth_otp_challenges",
    ["phone", "created_at"],
    {
      name: "idx_auth_otp_phone_created",
    },
  );

  await queryInterface.addIndex(
    "auth_otp_challenges",
    ["phone", "status", "expires_at"],
    {
      name: "idx_auth_otp_phone_status_expiry",
    },
  );

  await queryInterface.addIndex("auth_otp_challenges", ["created_at"], {
    name: "idx_auth_otp_created_at",
  });
}

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable("auth_otp_challenges");
}
