import { DataTypes } from "sequelize";

export async function up({ context: queryInterface }) {
  await queryInterface.addColumn("accounts", "profile_photo_storage_key", {
    type: DataTypes.STRING(500),
    allowNull: true,
    after: "photo_url",
  });
}

export async function down({ context: queryInterface }) {
  await queryInterface.removeColumn("accounts", "profile_photo_storage_key");
}
