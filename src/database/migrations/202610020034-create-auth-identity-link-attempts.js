import { DataTypes } from "sequelize";

export async function up({ context: queryInterface }) {
  await queryInterface.createTable("auth_identity_link_attempts", {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,

      allowNull: false,

      autoIncrement: true,

      primaryKey: true,
    },

    attempt_uuid: {
      type: DataTypes.CHAR(36),

      allowNull: false,
    },

    provider: {
      type: DataTypes.STRING(32),

      allowNull: false,
    },

    provider_subject: {
      type: DataTypes.STRING(191),

      allowNull: false,
    },

    provider_email: {
      type: DataTypes.STRING(191),

      allowNull: true,
    },

    display_name: {
      type: DataTypes.STRING(200),

      allowNull: true,
    },

    /*
     * linkToken itself is never stored.
     */
    token_hash: {
      type: DataTypes.CHAR(64),

      allowNull: false,
    },

    token_jti: {
      type: DataTypes.CHAR(36),

      allowNull: false,
    },

    /*
     * pending
     * verified
     * consumed
     * superseded
     * expired
     */
    status: {
      type: DataTypes.STRING(20),

      allowNull: false,

      defaultValue: "pending",
    },

    verified_phone: {
      type: DataTypes.STRING(20),

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

  await queryInterface.addIndex(
    "auth_identity_link_attempts",
    ["attempt_uuid"],
    {
      name: "uq_auth_identity_link_attempts_uuid",

      unique: true,
    },
  );

  await queryInterface.addIndex(
    "auth_identity_link_attempts",
    ["provider", "provider_subject", "status"],
    {
      name: "idx_auth_identity_link_provider_subject_status",
    },
  );

  await queryInterface.addIndex("auth_identity_link_attempts", ["expires_at"], {
    name: "idx_auth_identity_link_expires_at",
  });
}

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable("auth_identity_link_attempts");
}
