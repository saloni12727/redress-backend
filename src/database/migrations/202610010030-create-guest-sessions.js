import { DataTypes } from "sequelize";

export async function up({ context: queryInterface }) {
  await queryInterface.createTable("guest_sessions", {
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

    /*
     * Flutter sends its random installation UUID.
     *
     * We never store that UUID directly.
     * Only SHA-256 hash is stored.
     */
    installation_id_hash: {
      type: DataTypes.CHAR(64),
      allowNull: false,
    },

    /*
     * If we reissue a guest token, token_version changes.
     * Old guest tokens immediately stop working.
     */
    token_version: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 1,
    },

    platform: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },

    app_version: {
      type: DataTypes.STRING(50),
      allowNull: true,
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

    /*
     * Filled after login/signup + guest-data merge.
     */
    converted_account_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,

      references: {
        model: "accounts",
        key: "id",
      },

      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },

    last_seen_at: {
      type: DataTypes.DATE,
      allowNull: false,
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

  await queryInterface.addIndex("guest_sessions", ["session_uuid"], {
    unique: true,
    name: "uq_guest_sessions_session_uuid",
  });

  await queryInterface.addIndex(
    "guest_sessions",
    ["installation_id_hash", "platform", "status"],
    {
      name: "idx_guest_sessions_installation",
    },
  );

  await queryInterface.addIndex("guest_sessions", ["converted_account_id"], {
    name: "idx_guest_sessions_converted_account",
  });

  await queryInterface.addIndex("guest_sessions", ["expires_at"], {
    name: "idx_guest_sessions_expires_at",
  });
}

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable("guest_sessions");
}
