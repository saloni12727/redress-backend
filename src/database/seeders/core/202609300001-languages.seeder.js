import { Op, QueryTypes } from "sequelize";

/*
|--------------------------------------------------------------------------
| Core Languages
|--------------------------------------------------------------------------
|
| Redress initial supported languages:
|
| Italian = default
| English = secondary
|
*/

const CORE_LANGUAGES = [
  {
    code: "it",

    name: "Italiano",

    is_default: true,

    is_active: true,
  },

  {
    code: "en",

    name: "English",

    is_default: false,

    is_active: true,
  },
];

const CORE_LANGUAGE_CODES = CORE_LANGUAGES.map((language) => language.code);

/*
|--------------------------------------------------------------------------
| Seed
|--------------------------------------------------------------------------
*/

export async function up({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    /*
     * Find languages which already exist.
     *
     * Seeder remains safe if accidentally
     * executed again.
     */

    const existingLanguages = await queryInterface.sequelize.query(
      `
          SELECT code
          FROM languages
          WHERE code IN ('it', 'en')
        `,

      {
        type: QueryTypes.SELECT,

        transaction,
      },
    );

    const existingCodes = new Set(
      existingLanguages.map((language) => language.code),
    );

    /*
     * Insert only missing languages.
     */

    const now = new Date();

    const missingLanguages = CORE_LANGUAGES.filter(
      (language) => !existingCodes.has(language.code),
    ).map((language) => ({
      ...language,

      created_at: now,

      updated_at: now,
    }));

    if (missingLanguages.length > 0) {
      await queryInterface.bulkInsert(
        "languages",

        missingLanguages,

        {
          transaction,
        },
      );
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();

    throw error;
  }
}

/*
|--------------------------------------------------------------------------
| Rollback Seeder
|--------------------------------------------------------------------------
|
| Only removes records inserted as part of
| Redress core language setup.
|
*/

export async function down({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    await queryInterface.bulkDelete(
      "languages",

      {
        code: {
          [Op.in]: CORE_LANGUAGE_CODES,
        },
      },

      {
        transaction,
      },
    );

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();

    throw error;
  }
}
