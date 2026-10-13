import { DataTypes } from "sequelize";

export async function up({ context: queryInterface }) {
  let columns = await queryInterface.describeTable("accounts");

  if (!columns.consent_privacy_accepted_at) {
    await queryInterface.addColumn("accounts", "consent_privacy_accepted_at", {
      type: DataTypes.DATE,
      allowNull: true,
    });
  }

  columns = await queryInterface.describeTable("accounts");

  if (!columns.consent_privacy_version) {
    await queryInterface.addColumn("accounts", "consent_privacy_version", {
      type: DataTypes.STRING(64),
      allowNull: true,
    });
  }

  columns = await queryInterface.describeTable("accounts");

  if (!columns.consent_channel) {
    await queryInterface.addColumn("accounts", "consent_channel", {
      type: DataTypes.STRING(32),
      allowNull: true,
    });
  }

  columns = await queryInterface.describeTable("accounts");

  if (!columns.fit_setup_skipped_at) {
    await queryInterface.addColumn("accounts", "fit_setup_skipped_at", {
      type: DataTypes.DATE,
      allowNull: true,
    });
  }
}

export async function down({ context: queryInterface }) {
  let columns = await queryInterface.describeTable("accounts");

  if (columns.fit_setup_skipped_at) {
    await queryInterface.removeColumn("accounts", "fit_setup_skipped_at");
  }

  columns = await queryInterface.describeTable("accounts");

  if (columns.consent_channel) {
    await queryInterface.removeColumn("accounts", "consent_channel");
  }

  columns = await queryInterface.describeTable("accounts");

  if (columns.consent_privacy_version) {
    await queryInterface.removeColumn("accounts", "consent_privacy_version");
  }

  columns = await queryInterface.describeTable("accounts");

  if (columns.consent_privacy_accepted_at) {
    await queryInterface.removeColumn(
      "accounts",
      "consent_privacy_accepted_at",
    );
  }
}
