import { DataTypes } from "sequelize";

/*
 * Keep the operational rejection decision with the vendor application so an
 * owner can correct the application without relying on an external message.
 */
export async function up({ context: queryInterface }) {
  await queryInterface.addColumn("vendors", "rejection_reason", {
    type: DataTypes.TEXT,
    allowNull: true,
  });
}

export async function down({ context: queryInterface }) {
  await queryInterface.removeColumn("vendors", "rejection_reason");
}
