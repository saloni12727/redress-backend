import { DataTypes } from "sequelize";

export async function up({ context: queryInterface }) {
  await queryInterface.createTable("auth_sessions", {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    session_uuid: {
      type: DataTypes.CHAR(36),
      allowNull: false,
    },

    account_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,

      references: {
        model: "accounts",
        key: "id",
      },

      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },

    refresh_token_hash: {
      type: DataTypes.CHAR(64),
      allowNull: false,
    },

    refresh_jti: {
      type: DataTypes.CHAR(36),
      allowNull: false,
    },

    /*
     * Helps distinguish a genuine stolen/reused refresh token
     * from two refresh requests happening nearly simultaneously.
     */
    previous_refresh_token_hash: {
      type: DataTypes.CHAR(64),
      allowNull: true,
    },

    previous_refresh_jti: {
      type: DataTypes.CHAR(36),
      allowNull: true,
    },

    previous_refresh_valid_until: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "active",
    },

    /*
     * web / native
     *
     * Informational only.
     * Never trust client_type as an authorization decision.
     */
    client_type: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "native",
    },

    device_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    device_name: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },

    user_agent: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },

    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },

    last_used_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },

    revoked_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    revoke_reason: {
      type: DataTypes.STRING(50),
      allowNull: true,
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

  await queryInterface.addIndex("auth_sessions", ["session_uuid"], {
    unique: true,
    name: "uq_auth_sessions_session_uuid",
  });

  await queryInterface.addIndex("auth_sessions", ["account_id", "status"], {
    name: "idx_auth_sessions_account_status",
  });

  await queryInterface.addIndex("auth_sessions", ["expires_at"], {
    name: "idx_auth_sessions_expires_at",
  });
}

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable("auth_sessions");
}
