import { DataTypes } from "sequelize";

/*
|--------------------------------------------------------------------------
| Reconcile auth_sessions.client_type
|--------------------------------------------------------------------------
|
| Some existing production databases were created before client_type
| existed in auth_sessions.
|
| The current auth repository stores:
|
|   client_type = web | native
|
| on every authenticated session.
|
| Never edit/re-run an already executed migration.
| This forward migration safely adds the missing column only when needed.
|
*/

export async function up({ context: queryInterface }) {
  const table = await queryInterface.describeTable("auth_sessions");

  if (!table.client_type) {
    await queryInterface.addColumn("auth_sessions", "client_type", {
      type: DataTypes.STRING(20),

      allowNull: false,

      defaultValue: "native",
    });
  }
}

export async function down({ context: queryInterface }) {
  const table = await queryInterface.describeTable("auth_sessions");

  if (table.client_type) {
    await queryInterface.removeColumn("auth_sessions", "client_type");
  }
}
