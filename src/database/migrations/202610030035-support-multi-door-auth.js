import { DataTypes, QueryTypes } from "sequelize";

/*
|--------------------------------------------------------------------------
| Multi-door authentication migration
|--------------------------------------------------------------------------
|
| Redress supports one account with multiple authentication doors:
|
| - mobile OTP
| - email + password (email verified by OTP during signup)
| - Google
|
| Therefore an account may legitimately have:
|
| - phone only            -> email/password are NULL
| - email + password      -> phone is NULL until needed later
| - Google                -> password/phone are NULL until added later
|
| OTP challenges are also made channel-aware so the same table safely serves
| both SMS and email verification without storing raw OTP values.
|
*/

export async function up({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    await queryInterface.changeColumn(
      "accounts",
      "email",
      {
        type: DataTypes.STRING(191),
        allowNull: true,
      },
      { transaction },
    );

    await queryInterface.changeColumn(
      "accounts",
      "password_hash",
      {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      { transaction },
    );

    await queryInterface.changeColumn(
      "accounts",
      "first_name",
      {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      { transaction },
    );

    await queryInterface.addColumn(
      "auth_otp_challenges",
      "channel",
      {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: "sms",
      },
      { transaction },
    );

    await queryInterface.addColumn(
      "auth_otp_challenges",
      "destination",
      {
        type: DataTypes.STRING(254),
        allowNull: true,
      },
      { transaction },
    );

    /* Backfill existing phone OTP challenges before destination becomes NOT NULL. */
    await queryInterface.sequelize.query(
      `
        UPDATE auth_otp_challenges
        SET
          channel = 'sms',
          destination = phone
        WHERE destination IS NULL
      `,
      {
        type: QueryTypes.UPDATE,
        transaction,
      },
    );

    await queryInterface.changeColumn(
      "auth_otp_challenges",
      "destination",
      {
        type: DataTypes.STRING(254),
        allowNull: false,
      },
      { transaction },
    );

    /* Email OTP rows do not have a phone value. Keep the legacy column nullable. */
    await queryInterface.changeColumn(
      "auth_otp_challenges",
      "phone",
      {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      { transaction },
    );

    await queryInterface.addIndex(
      "auth_otp_challenges",
      ["channel", "destination", "created_at"],
      {
        name: "idx_auth_otp_channel_destination_created",
        transaction,
      },
    );

    await queryInterface.addIndex(
      "auth_otp_challenges",
      ["channel", "destination", "status", "expires_at"],
      {
        name: "idx_auth_otp_channel_destination_status_expiry",
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
      "idx_auth_otp_channel_destination_status_expiry",
      { transaction },
    );

    await queryInterface.removeIndex(
      "auth_otp_challenges",
      "idx_auth_otp_channel_destination_created",
      { transaction },
    );

    /* Email challenges cannot exist in the legacy phone-only schema. */
    await queryInterface.sequelize.query(
      `DELETE FROM auth_otp_challenges WHERE channel = 'email'`,
      {
        type: QueryTypes.DELETE,
        transaction,
      },
    );

    await queryInterface.sequelize.query(
      `
        UPDATE auth_otp_challenges
        SET phone = destination
        WHERE channel = 'sms' AND phone IS NULL
      `,
      {
        type: QueryTypes.UPDATE,
        transaction,
      },
    );

    await queryInterface.changeColumn(
      "auth_otp_challenges",
      "phone",
      {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      { transaction },
    );

    await queryInterface.removeColumn("auth_otp_challenges", "destination", {
      transaction,
    });

    await queryInterface.removeColumn("auth_otp_challenges", "channel", {
      transaction,
    });

    /*
     * Rollback can only restore the old NOT NULL account rules if no newer
     * phone-only/Google-only accounts exist. This is intentionally strict.
     */
    const nullableRows = await queryInterface.sequelize.query(
      `
        SELECT COUNT(*) AS count
        FROM accounts
        WHERE email IS NULL
           OR password_hash IS NULL
           OR first_name IS NULL
      `,
      {
        type: QueryTypes.SELECT,
        transaction,
      },
    );

    if (Number(nullableRows[0]?.count ?? 0) > 0) {
      throw new Error(
        "Cannot rollback multi-door auth while accounts with nullable email/password/name exist.",
      );
    }

    await queryInterface.changeColumn(
      "accounts",
      "first_name",
      {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      { transaction },
    );

    await queryInterface.changeColumn(
      "accounts",
      "password_hash",
      {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      { transaction },
    );

    await queryInterface.changeColumn(
      "accounts",
      "email",
      {
        type: DataTypes.STRING(191),
        allowNull: false,
      },
      { transaction },
    );

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
