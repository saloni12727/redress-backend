import { DataTypes } from "sequelize";

export async function up({ context: queryInterface }) {
  await queryInterface.createTable("account_identities", {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,

      allowNull: false,

      autoIncrement: true,

      primaryKey: true,
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

    /*
     * google
     *
     * Apple/Facebook can be added later without
     * modifying accounts table.
     */
    provider: {
      type: DataTypes.STRING(32),

      allowNull: false,
    },

    /*
     * Google's stable "sub".
     *
     * Never use Google email as the provider identity.
     */
    provider_subject: {
      type: DataTypes.STRING(191),

      allowNull: false,
    },

    provider_email: {
      type: DataTypes.STRING(191),

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

  await queryInterface.addIndex(
    "account_identities",
    ["provider", "provider_subject"],
    {
      name: "uq_account_identities_provider_subject",

      unique: true,
    },
  );

  await queryInterface.addIndex(
    "account_identities",
    ["account_id", "provider"],
    {
      name: "uq_account_identities_account_provider",

      unique: true,
    },
  );

  await queryInterface.addIndex("account_identities", ["provider_email"], {
    name: "idx_account_identities_provider_email",
  });
}

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable("account_identities");
}
