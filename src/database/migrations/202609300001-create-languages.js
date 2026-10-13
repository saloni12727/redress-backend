import { DataTypes } from "sequelize";

/*
|--------------------------------------------------------------------------
| Create Languages Table
|--------------------------------------------------------------------------
|
| This table stores the languages supported by Redress.
|
| Initial supported languages:
|
| it → Italiano → default
| en → English
|
*/

export async function up({ context: queryInterface }) {
  await queryInterface.createTable("languages", {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    /*
     * Stable language code.
     *
     * Examples:
     * it
     * en
     *
     * We use code for references instead of assuming
     * numeric IDs such as 1 or 2.
     */

    code: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },

    /*
     * Human-readable language name.
     */

    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    /*
     * Only one language should normally be the
     * application default.
     *
     * Initial Redress default = Italian.
     */

    is_default: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    /*
     * Allows a language to be disabled without
     * deleting historical translation data.
     */

    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
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

  /*
   * Language codes must be unique.
   *
   * We must never have:
   *
   * it
   * it
   *
   * as two separate records.
   */

  await queryInterface.addIndex("languages", ["code"], {
    name: "uq_languages_code",
    unique: true,
  });
}

/*
|--------------------------------------------------------------------------
| Rollback
|--------------------------------------------------------------------------
*/

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable("languages");
}
