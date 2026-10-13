import { QueryTypes } from "sequelize";

const SIZE_SYSTEMS = [
  {
    code: "waist_in",
    name: "Waist Size (inches)",
    sizes: ["26", "28", "30", "32", "34", "36", "38", "40", "42", "44"],
  },

  {
    code: "kids_age",
    name: "Kids Age",
    sizes: [
      "2-3Y",
      "3-4Y",
      "4-5Y",
      "5-6Y",
      "6-7Y",
      "7-8Y",
      "8-9Y",
      "9-10Y",
      "10-11Y",
      "11-12Y",
      "12-13Y",
      "13-14Y",
    ],
  },

  {
    code: "one_size",
    name: "One Size",
    sizes: ["OS"],
  },
];

async function findSizeSystemId(queryInterface, code, transaction) {
  const rows = await queryInterface.sequelize.query(
    `
        SELECT id
        FROM size_systems
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

  return rows[0]?.id ?? null;
}

export async function up({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    for (const system of SIZE_SYSTEMS) {
      let sizeSystemId = await findSizeSystemId(
        queryInterface,
        system.code,
        transaction,
      );

      if (!sizeSystemId) {
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

        sizeSystemId = await findSizeSystemId(
          queryInterface,
          system.code,
          transaction,
        );
      }

      const existingSizes = await queryInterface.sequelize.query(
        `
            SELECT code
            FROM sizes
            WHERE size_system_id = :sizeSystemId
          `,
        {
          replacements: {
            sizeSystemId,
          },

          type: QueryTypes.SELECT,
          transaction,
        },
      );

      const existingCodes = new Set(existingSizes.map((row) => row.code));

      const now = new Date();

      const rows = system.sizes
        .filter((size) => !existingCodes.has(size))
        .map((size, index) => ({
          size_system_id: sizeSystemId,

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
    for (const system of [...SIZE_SYSTEMS].reverse()) {
      const sizeSystemId = await findSizeSystemId(
        queryInterface,
        system.code,
        transaction,
      );

      if (!sizeSystemId) {
        continue;
      }

      await queryInterface.bulkDelete(
        "sizes",
        {
          size_system_id: sizeSystemId,
        },
        {
          transaction,
        },
      );

      await queryInterface.bulkDelete(
        "size_systems",
        {
          id: sizeSystemId,
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
