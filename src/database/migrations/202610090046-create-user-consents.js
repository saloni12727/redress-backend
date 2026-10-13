import { DataTypes } from "sequelize";

export async function up({ context: queryInterface }) {
  await queryInterface.createTable("user_consents", {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    account_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      references: { model: "accounts", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
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
    accepted_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    channel: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  });

  await queryInterface.addIndex(
    "user_consents",
    ["account_id", "kind", "accepted_at"],
    { name: "idx_user_consents_account_kind" },
  );
}

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable("user_consents");
}
