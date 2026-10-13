import { Op, QueryTypes } from "sequelize";

const CATEGORY_ATTRIBUTES = {
  women_dresses: [
    "fabric",
    "pattern",
    "sleeve_length",
    "neck_type",
    "occasion",
    "closure",
    "stretchability",
    "transparency",
    "dress_shape",
    "dress_length",
  ],

  women_tops: [
    "fabric",
    "pattern",
    "sleeve_length",
    "neck_type",
    "occasion",
    "stretchability",
    "transparency",
  ],

  women_tshirts: [
    "fabric",
    "pattern",
    "sleeve_length",
    "neck_type",
    "occasion",
    "stretchability",
  ],

  women_jeans: [
    "fabric",
    "pattern",
    "waist_rise",
    "closure",
    "stretchability",
    "occasion",
  ],

  women_trousers: [
    "fabric",
    "pattern",
    "waist_rise",
    "closure",
    "stretchability",
    "occasion",
  ],

  women_skirts: ["fabric", "pattern", "waist_rise", "closure", "occasion"],

  women_kurtas_kurtis: [
    "fabric",
    "pattern",
    "sleeve_length",
    "neck_type",
    "occasion",
    "closure",
  ],

  women_sarees: ["fabric", "pattern", "occasion", "transparency"],

  women_lehenga: ["fabric", "pattern", "occasion", "closure"],

  women_heels: [
    "upper_material",
    "sole_material",
    "heel_type",
    "heel_height_cm",
    "toe_shape",
    "closure",
    "shoe_width",
    "occasion",
  ],

  women_flats: [
    "upper_material",
    "sole_material",
    "toe_shape",
    "closure",
    "shoe_width",
    "occasion",
  ],

  women_sports_shoes: [
    "upper_material",
    "sole_material",
    "closure",
    "shoe_width",
    "occasion",
  ],

  men_tshirts: [
    "fabric",
    "pattern",
    "sleeve_length",
    "neck_type",
    "occasion",
    "stretchability",
  ],

  men_casual_shirts: [
    "fabric",
    "pattern",
    "sleeve_length",
    "collar_type",
    "closure",
    "occasion",
  ],

  men_formal_shirts: [
    "fabric",
    "pattern",
    "sleeve_length",
    "collar_type",
    "closure",
    "occasion",
  ],

  men_jackets: ["fabric", "pattern", "closure", "occasion"],

  men_jeans: [
    "fabric",
    "pattern",
    "waist_rise",
    "closure",
    "stretchability",
    "occasion",
  ],

  men_trousers: [
    "fabric",
    "pattern",
    "waist_rise",
    "closure",
    "stretchability",
    "occasion",
  ],

  men_shorts: ["fabric", "pattern", "waist_rise", "closure", "occasion"],

  men_casual_shoes: [
    "upper_material",
    "sole_material",
    "toe_shape",
    "closure",
    "shoe_width",
    "occasion",
  ],

  men_formal_shoes: [
    "upper_material",
    "sole_material",
    "toe_shape",
    "closure",
    "shoe_width",
    "occasion",
  ],

  men_sports_shoes: [
    "upper_material",
    "sole_material",
    "closure",
    "shoe_width",
    "occasion",
  ],

  boys_tshirts: ["fabric", "pattern", "sleeve_length", "neck_type", "occasion"],

  boys_shirts: [
    "fabric",
    "pattern",
    "sleeve_length",
    "collar_type",
    "closure",
    "occasion",
  ],

  boys_jeans: ["fabric", "pattern", "waist_rise", "closure", "stretchability"],

  girls_dresses: [
    "fabric",
    "pattern",
    "sleeve_length",
    "neck_type",
    "closure",
    "dress_shape",
    "dress_length",
    "occasion",
  ],

  girls_tops: ["fabric", "pattern", "sleeve_length", "neck_type", "occasion"],

  girls_leggings: ["fabric", "pattern", "stretchability", "occasion"],

  bags: ["bag_type", "upper_material", "closure", "occasion"],

  belts: ["upper_material", "closure", "occasion"],

  wallets: ["upper_material", "closure", "occasion"],

  fashion_jewellery: ["jewellery_type", "occasion"],
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
    for (const [categoryCode, attributeCodes] of Object.entries(
      CATEGORY_ATTRIBUTES,
    )) {
      const categoryId = await getId(
        queryInterface,
        "categories",
        categoryCode,
        transaction,
      );

      for (const [index, attributeCode] of attributeCodes.entries()) {
        const attributeId = await getId(
          queryInterface,
          "attributes",
          attributeCode,
          transaction,
        );

        const existing = await queryInterface.sequelize.query(
          `
              SELECT id
              FROM category_attributes
              WHERE category_id = :categoryId
                AND attribute_id = :attributeId
              LIMIT 1
            `,
          {
            replacements: {
              categoryId,
              attributeId,
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
          "category_attributes",
          [
            {
              category_id: categoryId,

              attribute_id: attributeId,

              is_required: index < 3,

              is_filterable: true,

              is_variant_attribute: false,

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
    for (const [categoryCode, attributeCodes] of Object.entries(
      CATEGORY_ATTRIBUTES,
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

      const attributeRows = await queryInterface.sequelize.query(
        `
            SELECT id
            FROM attributes
            WHERE code IN (:codes)
          `,
        {
          replacements: {
            codes: attributeCodes,
          },

          type: QueryTypes.SELECT,

          transaction,
        },
      );

      const attributeIds = attributeRows.map((row) => row.id);

      if (attributeIds.length === 0) {
        continue;
      }

      await queryInterface.bulkDelete(
        "category_attributes",
        {
          category_id: categoryRows[0].id,

          attribute_id: {
            [Op.in]: attributeIds,
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
