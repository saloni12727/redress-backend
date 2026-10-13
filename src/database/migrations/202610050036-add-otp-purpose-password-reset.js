import { DataTypes, QueryTypes } from "sequelize";

/*
|--------------------------------------------------------------------------
| OTP purpose + password-reset proof support
|--------------------------------------------------------------------------
|
| OTP challenges are shared infrastructure, but every challenge is bound to
| exactly one purpose. A code issued for normal auth can therefore never be
| accepted for password reset or phone linking.
|
| Password-reset completion uses a random opaque one-time token. Only its
| SHA-256 hash is stored in the database.
|
*/

export async function up({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    await queryInterface.addColumn(
      "auth_otp_challenges",
      "purpose",
      {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "auth",
      },
      { transaction },
    );

    await queryInterface.addColumn(
      "auth_otp_challenges",
      "reset_token_hash",
      {
        type: DataTypes.CHAR(64),
        allowNull: true,
      },
      { transaction },
    );

    await queryInterface.addColumn(
      "auth_otp_challenges",
      "reset_expires_at",
      {
        type: DataTypes.DATE,
        allowNull: true,
      },
      { transaction },
    );

    await queryInterface.sequelize.query(
      `
        UPDATE auth_otp_challenges
        SET purpose = 'auth'
        WHERE purpose IS NULL OR purpose = ''
      `,
      {
        type: QueryTypes.UPDATE,
        transaction,
      },
    );

    await queryInterface.addIndex(
      "auth_otp_challenges",
      ["purpose", "channel", "destination", "created_at"],
      {
        name: "idx_auth_otp_purpose_channel_destination_created",
        transaction,
      },
    );

    await queryInterface.addIndex(
      "auth_otp_challenges",
      ["purpose", "channel", "destination", "status", "expires_at"],
      {
        name: "idx_auth_otp_purpose_channel_destination_status_expiry",
        transaction,
      },
    );

    await queryInterface.addIndex("auth_otp_challenges", ["reset_token_hash"], {
      name: "uq_auth_otp_reset_token_hash",
      unique: true,
      transaction,
    });

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
      "uq_auth_otp_reset_token_hash",
      { transaction },
    );

    await queryInterface.removeIndex(
      "auth_otp_challenges",
      "idx_auth_otp_purpose_channel_destination_status_expiry",
      { transaction },
    );

    await queryInterface.removeIndex(
      "auth_otp_challenges",
      "idx_auth_otp_purpose_channel_destination_created",
      { transaction },
    );

    await queryInterface.removeColumn(
      "auth_otp_challenges",
      "reset_expires_at",
      { transaction },
    );

    await queryInterface.removeColumn(
      "auth_otp_challenges",
      "reset_token_hash",
      { transaction },
    );

    await queryInterface.removeColumn("auth_otp_challenges", "purpose", {
      transaction,
    });

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
