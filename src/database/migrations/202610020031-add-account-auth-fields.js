import { DataTypes, QueryTypes } from "sequelize";

export async function up({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    await queryInterface.addColumn(
      "accounts",
      "phone",
      {
        type: DataTypes.STRING(20),

        allowNull: true,
      },
      {
        transaction,
      },
    );

    await queryInterface.addColumn(
      "accounts",
      "phone_verified_at",
      {
        type: DataTypes.DATE,

        allowNull: true,
      },
      {
        transaction,
      },
    );

    await queryInterface.addColumn(
      "accounts",
      "display_name",
      {
        type: DataTypes.STRING(200),

        allowNull: true,
      },
      {
        transaction,
      },
    );

    await queryInterface.addColumn(
      "accounts",
      "photo_url",
      {
        type: DataTypes.STRING(500),

        allowNull: true,
      },
      {
        transaction,
      },
    );

    await queryInterface.addColumn(
      "accounts",
      "locale",
      {
        type: DataTypes.STRING(5),

        allowNull: false,

        defaultValue: "it",
      },
      {
        transaction,
      },
    );

    /*
     * Backfill display name for existing accounts,
     * including the existing Super Admin.
     */
    await queryInterface.sequelize.query(
      `
        UPDATE accounts

        SET display_name =
          TRIM(
            CONCAT_WS(
              ' ',
              first_name,
              last_name
            )
          )

        WHERE display_name
          IS NULL
      `,
      {
        type: QueryTypes.UPDATE,

        transaction,
      },
    );

    /*
     * MySQL allows multiple NULL values in a unique index.
     * Therefore existing Admin accounts can keep phone = NULL.
     */
    await queryInterface.addIndex("accounts", ["phone"], {
      name: "uq_accounts_phone",

      unique: true,

      transaction,
    });

    await queryInterface.addIndex("accounts", ["locale"], {
      name: "idx_accounts_locale",

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
    await queryInterface.removeIndex("accounts", "idx_accounts_locale", {
      transaction,
    });

    await queryInterface.removeIndex("accounts", "uq_accounts_phone", {
      transaction,
    });

    await queryInterface.removeColumn("accounts", "locale", {
      transaction,
    });

    await queryInterface.removeColumn("accounts", "photo_url", {
      transaction,
    });

    await queryInterface.removeColumn("accounts", "display_name", {
      transaction,
    });

    await queryInterface.removeColumn("accounts", "phone_verified_at", {
      transaction,
    });

    await queryInterface.removeColumn("accounts", "phone", {
      transaction,
    });

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();

    throw error;
  }
}
