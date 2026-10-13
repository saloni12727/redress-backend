import { Op, QueryTypes } from "sequelize";

const REQUIREMENTS = {
  women_dresses: [
    "bust_circumference",
    "waist_circumference",
    "hip_circumference",
    "shoulder_width",
    "dress_length",
  ],

  women_tops: [
    "bust_circumference",
    "waist_circumference",
    "shoulder_width",
    "sleeve_length",
    "garment_length",
  ],

  women_tshirts: [
    "bust_circumference",
    "waist_circumference",
    "shoulder_width",
    "sleeve_length",
    "garment_length",
  ],

  women_jeans: [
    "waist_circumference",
    "hip_circumference",
    "thigh_circumference",
    "front_rise",
    "inseam_length",
    "leg_opening",
  ],

  women_trousers: [
    "waist_circumference",
    "hip_circumference",
    "thigh_circumference",
    "front_rise",
    "inseam_length",
    "leg_opening",
  ],

  women_skirts: ["waist_circumference", "hip_circumference", "skirt_length"],

  women_kurtas_kurtis: [
    "bust_circumference",
    "waist_circumference",
    "hip_circumference",
    "shoulder_width",
    "sleeve_length",
    "garment_length",
  ],

  women_lehenga: ["waist_circumference", "hip_circumference", "skirt_length"],

  men_tshirts: [
    "chest_circumference",
    "waist_circumference",
    "shoulder_width",
    "sleeve_length",
    "garment_length",
  ],

  men_casual_shirts: [
    "chest_circumference",
    "waist_circumference",
    "shoulder_width",
    "sleeve_length",
    "garment_length",
    "neck_circumference",
  ],

  men_formal_shirts: [
    "chest_circumference",
    "waist_circumference",
    "shoulder_width",
    "sleeve_length",
    "garment_length",
    "neck_circumference",
  ],

  men_jackets: [
    "chest_circumference",
    "waist_circumference",
    "shoulder_width",
    "sleeve_length",
    "garment_length",
  ],

  men_jeans: [
    "waist_circumference",
    "hip_circumference",
    "thigh_circumference",
    "front_rise",
    "inseam_length",
    "leg_opening",
  ],

  men_trousers: [
    "waist_circumference",
    "hip_circumference",
    "thigh_circumference",
    "front_rise",
    "inseam_length",
    "leg_opening",
  ],

  men_shorts: [
    "waist_circumference",
    "hip_circumference",
    "thigh_circumference",
    "front_rise",
    "garment_length",
  ],

  boys_tshirts: [
    "chest_circumference",
    "shoulder_width",
    "sleeve_length",
    "garment_length",
  ],

  boys_shirts: [
    "chest_circumference",
    "shoulder_width",
    "sleeve_length",
    "garment_length",
  ],

  boys_jeans: ["waist_circumference", "hip_circumference", "inseam_length"],

  girls_dresses: [
    "bust_circumference",
    "waist_circumference",
    "hip_circumference",
    "shoulder_width",
    "dress_length",
  ],

  girls_tops: [
    "bust_circumference",
    "shoulder_width",
    "sleeve_length",
    "garment_length",
  ],

  girls_leggings: ["waist_circumference", "hip_circumference", "inseam_length"],
};

async function getId(queryInterface, table, code, transaction) {
  const rows = await queryInterface.sequelize.query(
    `
        SELECT id
        FROM ${table}
        WHERE code = :code
        LIMIT 1
      `,
    {
      replacements: {
        code,
      },

      type: QueryTypes.SELECT,

      transaction,
    },
  );

  if (!rows[0]?.id) {
    throw new Error(`${table} record not found: ${code}`);
  }

  return rows[0].id;
}

export async function up({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    for (const [categoryCode, measurementCodes] of Object.entries(
      REQUIREMENTS,
    )) {
      const categoryId = await getId(
        queryInterface,
        "categories",
        categoryCode,
        transaction,
      );

      for (const [index, measurementCode] of measurementCodes.entries()) {
        const measurementTypeId = await getId(
          queryInterface,
          "garment_measurement_types",
          measurementCode,
          transaction,
        );

        const existing = await queryInterface.sequelize.query(
          `
              SELECT id
              FROM category_measurement_requirements
              WHERE category_id = :categoryId
                AND measurement_type_id = :measurementTypeId
              LIMIT 1
            `,
          {
            replacements: {
              categoryId,
              measurementTypeId,
            },

            type: QueryTypes.SELECT,

            transaction,
          },
        );

        if (existing.length > 0) {
          continue;
        }

        const now = new Date();

        await queryInterface.bulkInsert(
          "category_measurement_requirements",
          [
            {
              category_id: categoryId,

              measurement_type_id: measurementTypeId,

              is_required: true,

              sort_order: (index + 1) * 10,

              is_active: true,

              created_at: now,

              updated_at: now,
            },
          ],
          {
            transaction,
          },
        );
      }
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function down({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    for (const [categoryCode, measurementCodes] of Object.entries(
      REQUIREMENTS,
    )) {
      const categoryRows = await queryInterface.sequelize.query(
        `
            SELECT id
            FROM categories
            WHERE code = :code
            LIMIT 1
          `,
        {
          replacements: {
            code: categoryCode,
          },

          type: QueryTypes.SELECT,

          transaction,
        },
      );

      if (!categoryRows[0]?.id) {
        continue;
      }

      const typeRows = await queryInterface.sequelize.query(
        `
            SELECT id
            FROM garment_measurement_types
            WHERE code IN (:codes)
          `,
        {
          replacements: {
            codes: measurementCodes,
          },

          type: QueryTypes.SELECT,

          transaction,
        },
      );

      const typeIds = typeRows.map((row) => row.id);

      if (typeIds.length === 0) {
        continue;
      }

      await queryInterface.bulkDelete(
        "category_measurement_requirements",
        {
          category_id: categoryRows[0].id,

          measurement_type_id: {
            [Op.in]: typeIds,
          },
        },
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
