import { QueryTypes } from "sequelize";

const SIZE_SYSTEMS = [
  {
    code: "alpha",

    name: "International Alpha",

    sizes: ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL"],
  },

  {
    code: "eu_clothing",

    name: "EU Clothing",

    sizes: ["32", "34", "36", "38", "40", "42", "44", "46", "48", "50", "52"],
  },

  {
    code: "eu_footwear",

    name: "EU Footwear",

    sizes: [
      "35",
      "36",
      "37",
      "38",
      "39",
      "40",
      "41",
      "42",
      "43",
      "44",
      "45",
      "46",
    ],
  },
];

export async function up({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    for (const system of SIZE_SYSTEMS) {
      const existingSystems = await queryInterface.sequelize.query(
        `
            SELECT id
            FROM size_systems
            WHERE code = :code
            LIMIT 1
          `,
        {
          replacements: {
            code: system.code,
          },

          type: QueryTypes.SELECT,

          transaction,
        },
      );

      let systemId;

      if (existingSystems.length > 0) {
        systemId = existingSystems[0].id;
      } else {
        const now = new Date();

        await queryInterface.bulkInsert(
          "size_systems",
          [
            {
              code: system.code,

              name: system.name,

              is_active: true,

              created_at: now,

              updated_at: now,
            },
          ],
          {
            transaction,
          },
        );

        const createdSystems = await queryInterface.sequelize.query(
          `
              SELECT id
              FROM size_systems
              WHERE code = :code
              LIMIT 1
            `,
          {
            replacements: {
              code: system.code,
            },

            type: QueryTypes.SELECT,

            transaction,
          },
        );

        systemId = createdSystems[0].id;
      }

      const existingSizes = await queryInterface.sequelize.query(
        `
            SELECT code
            FROM sizes
            WHERE size_system_id = :sizeSystemId
          `,
        {
          replacements: {
            sizeSystemId: systemId,
          },

          type: QueryTypes.SELECT,

          transaction,
        },
      );

      const existingCodes = new Set(existingSizes.map((size) => size.code));

      const now = new Date();

      const rows = system.sizes
        .filter((size) => !existingCodes.has(size))
        .map((size, index) => ({
          size_system_id: systemId,

          code: size,

          label: size,

          sort_order: (index + 1) * 10,

          is_active: true,

          created_at: now,

          updated_at: now,
        }));

      if (rows.length > 0) {
        await queryInterface.bulkInsert("sizes", rows, {
          transaction,
        });
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
    for (const system of SIZE_SYSTEMS) {
      const rows = await queryInterface.sequelize.query(
        `
            SELECT id
            FROM size_systems
            WHERE code = :code
            LIMIT 1
          `,
        {
          replacements: {
            code: system.code,
          },

          type: QueryTypes.SELECT,

          transaction,
        },
      );

      if (rows.length === 0) {
        continue;
      }

      const systemId = rows[0].id;

      await queryInterface.bulkDelete(
        "sizes",
        {
          size_system_id: systemId,
        },
        {
          transaction,
        },
      );

      await queryInterface.bulkDelete(
        "size_systems",
        {
          id: systemId,
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
