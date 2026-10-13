import { DataTypes } from "sequelize";

/*
|--------------------------------------------------------------------------
| Record how each authenticated session was created
|--------------------------------------------------------------------------
|
| New sessions use one of:
|
|   email_password
|   email_otp
|   phone_otp
|   google
|
| Existing historical sessions cannot always be classified reliably,
| therefore they remain/backfill as "unknown".
|
| Do NOT guess old otp/email rows because an old generic "otp"
| value does not reliably tell whether it came from email or phone.
|
*/

export async function up({ context: queryInterface }) {
  const table = await queryInterface.describeTable("auth_sessions");

  if (!table.auth_method) {
    await queryInterface.addColumn("auth_sessions", "auth_method", {
      type: DataTypes.STRING(20),

      allowNull: false,

      defaultValue: "unknown",
    });
  }
}

export async function down({ context: queryInterface }) {
  const table = await queryInterface.describeTable("auth_sessions");

  if (table.auth_method) {
    await queryInterface.removeColumn("auth_sessions", "auth_method");
  }
}
