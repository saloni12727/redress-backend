import { DataTypes } from "sequelize";

/*
|--------------------------------------------------------------------------
| Bind authenticated OTP challenges to the requesting account
|--------------------------------------------------------------------------
|
| Public authentication challenges intentionally keep account_id = NULL.
| Contact-change challenges are account-bound so an OTP requested by one
| signed-in account can never be consumed by another signed-in account.
|
*/

export async function up({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    await queryInterface.addColumn(
      "auth_otp_challenges",
      "account_id",
      {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
        references: {
          model: "accounts",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      { transaction },
    );

    await queryInterface.addIndex(
      "auth_otp_challenges",
      ["account_id", "purpose", "channel", "destination", "status"],
      {
        name: "idx_auth_otp_account_purpose_destination_status",
        transaction,
      },
    );

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function down({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    await queryInterface.removeIndex(
      "auth_otp_challenges",
      "idx_auth_otp_account_purpose_destination_status",
      { transaction },
    );

    await queryInterface.removeColumn("auth_otp_challenges", "account_id", {
      transaction,
    });

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
