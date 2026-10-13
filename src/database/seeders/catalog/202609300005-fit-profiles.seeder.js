import { Op, QueryTypes } from "sequelize";

const FIT_PROFILES = [
  {
    code: "slim",
    name: "Slim",
    sort_order: 10,
  },

  {
    code: "regular",
    name: "Regular",
    sort_order: 20,
  },

  {
    code: "relaxed",
    name: "Relaxed",
    sort_order: 30,
  },

  {
    code: "oversized",
    name: "Oversized",
    sort_order: 40,
  },
];

const FIT_CODES = FIT_PROFILES.map((profile) => profile.code);

export async function up({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    const existing = await queryInterface.sequelize.query(
      `
          SELECT code
          FROM fit_profiles
          WHERE code IN (:codes)
        `,
      {
        replacements: {
          codes: FIT_CODES,
        },

        type: QueryTypes.SELECT,

        transaction,
      },
    );

    const existingCodes = new Set(existing.map((profile) => profile.code));

    const now = new Date();

    const rows = FIT_PROFILES.filter(
      (profile) => !existingCodes.has(profile.code),
    ).map((profile) => ({
      ...profile,

      is_active: true,

      created_at: now,

      updated_at: now,
    }));

    if (rows.length > 0) {
      await queryInterface.bulkInsert("fit_profiles", rows, {
        transaction,
      });
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();

    throw error;
  }
}

export async function down({ context: queryInterface }) {
  await queryInterface.bulkDelete("fit_profiles", {
    code: {
      [Op.in]: FIT_CODES,
    },
  });
}
