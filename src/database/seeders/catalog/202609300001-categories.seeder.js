import { Op, QueryTypes } from "sequelize";

const CATEGORY_TREE = [
  {
    code: "women",
    slug: "women",
    sortOrder: 10,

    translations: {
      it: "Donna",
      en: "Women",
    },

    children: [
      {
        code: "women_western_wear",
        slug: "women-western-wear",
        sortOrder: 10,

        translations: {
          it: "Abbigliamento occidentale",
          en: "Western Wear",
        },

        children: [
          {
            code: "women_dresses",
            slug: "women-dresses",
            sortOrder: 10,

            translations: {
              it: "Vestiti",
              en: "Dresses",
            },
          },

          {
            code: "women_tops",
            slug: "women-tops",
            sortOrder: 20,

            translations: {
              it: "Top",
              en: "Tops",
            },
          },

          {
            code: "women_tshirts",
            slug: "women-t-shirts",
            sortOrder: 30,

            translations: {
              it: "T-shirt",
              en: "T-Shirts",
            },
          },

          {
            code: "women_jeans",
            slug: "women-jeans",
            sortOrder: 40,

            translations: {
              it: "Jeans",
              en: "Jeans",
            },
          },

          {
            code: "women_trousers",
            slug: "women-trousers",
            sortOrder: 50,

            translations: {
              it: "Pantaloni",
              en: "Trousers",
            },
          },

          {
            code: "women_skirts",
            slug: "women-skirts",
            sortOrder: 60,

            translations: {
              it: "Gonne",
              en: "Skirts",
            },
          },
        ],
      },

      {
        code: "women_ethnic_wear",
        slug: "women-ethnic-wear",
        sortOrder: 20,

        translations: {
          it: "Abbigliamento etnico",
          en: "Ethnic Wear",
        },

        children: [
          {
            code: "women_kurtas_kurtis",
            slug: "women-kurtas-kurtis",
            sortOrder: 10,

            translations: {
              it: "Kurta e Kurti",
              en: "Kurtas & Kurtis",
            },
          },

          {
            code: "women_sarees",
            slug: "women-sarees",
            sortOrder: 20,

            translations: {
              it: "Sari",
              en: "Sarees",
            },
          },

          {
            code: "women_lehenga",
            slug: "women-lehenga",
            sortOrder: 30,

            translations: {
              it: "Lehenga",
              en: "Lehenga Cholis",
            },
          },
        ],
      },

      {
        code: "women_footwear",
        slug: "women-footwear",
        sortOrder: 30,

        translations: {
          it: "Calzature donna",
          en: "Footwear",
        },

        children: [
          {
            code: "women_heels",
            slug: "women-heels",
            sortOrder: 10,

            translations: {
              it: "Tacchi",
              en: "Heels",
            },
          },

          {
            code: "women_flats",
            slug: "women-flats",
            sortOrder: 20,

            translations: {
              it: "Scarpe basse",
              en: "Flats",
            },
          },

          {
            code: "women_sports_shoes",
            slug: "women-sports-shoes",
            sortOrder: 30,

            translations: {
              it: "Scarpe sportive",
              en: "Sports Shoes",
            },
          },
        ],
      },
    ],
  },

  {
    code: "men",
    slug: "men",
    sortOrder: 20,

    translations: {
      it: "Uomo",
      en: "Men",
    },

    children: [
      {
        code: "men_topwear",
        slug: "men-topwear",
        sortOrder: 10,

        translations: {
          it: "Abbigliamento superiore",
          en: "Topwear",
        },

        children: [
          {
            code: "men_tshirts",
            slug: "men-t-shirts",
            sortOrder: 10,

            translations: {
              it: "T-shirt",
              en: "T-Shirts",
            },
          },

          {
            code: "men_casual_shirts",
            slug: "men-casual-shirts",
            sortOrder: 20,

            translations: {
              it: "Camicie casual",
              en: "Casual Shirts",
            },
          },

          {
            code: "men_formal_shirts",
            slug: "men-formal-shirts",
            sortOrder: 30,

            translations: {
              it: "Camicie formali",
              en: "Formal Shirts",
            },
          },

          {
            code: "men_jackets",
            slug: "men-jackets",
            sortOrder: 40,

            translations: {
              it: "Giacche",
              en: "Jackets",
            },
          },
        ],
      },

      {
        code: "men_bottomwear",
        slug: "men-bottomwear",
        sortOrder: 20,

        translations: {
          it: "Abbigliamento inferiore",
          en: "Bottomwear",
        },

        children: [
          {
            code: "men_jeans",
            slug: "men-jeans",
            sortOrder: 10,

            translations: {
              it: "Jeans",
              en: "Jeans",
            },
          },

          {
            code: "men_trousers",
            slug: "men-trousers",
            sortOrder: 20,

            translations: {
              it: "Pantaloni",
              en: "Trousers",
            },
          },

          {
            code: "men_shorts",
            slug: "men-shorts",
            sortOrder: 30,

            translations: {
              it: "Pantaloncini",
              en: "Shorts",
            },
          },
        ],
      },

      {
        code: "men_footwear",
        slug: "men-footwear",
        sortOrder: 30,

        translations: {
          it: "Calzature uomo",
          en: "Footwear",
        },

        children: [
          {
            code: "men_casual_shoes",
            slug: "men-casual-shoes",
            sortOrder: 10,

            translations: {
              it: "Scarpe casual",
              en: "Casual Shoes",
            },
          },

          {
            code: "men_formal_shoes",
            slug: "men-formal-shoes",
            sortOrder: 20,

            translations: {
              it: "Scarpe formali",
              en: "Formal Shoes",
            },
          },

          {
            code: "men_sports_shoes",
            slug: "men-sports-shoes",
            sortOrder: 30,

            translations: {
              it: "Scarpe sportive",
              en: "Sports Shoes",
            },
          },
        ],
      },
    ],
  },

  {
    code: "kids",
    slug: "kids",
    sortOrder: 30,

    translations: {
      it: "Bambini",
      en: "Kids",
    },

    children: [
      {
        code: "kids_boys_clothing",
        slug: "boys-clothing",
        sortOrder: 10,

        translations: {
          it: "Abbigliamento bambino",
          en: "Boys Clothing",
        },

        children: [
          {
            code: "boys_tshirts",
            slug: "boys-t-shirts",
            sortOrder: 10,

            translations: {
              it: "T-shirt bambino",
              en: "T-Shirts",
            },
          },

          {
            code: "boys_shirts",
            slug: "boys-shirts",
            sortOrder: 20,

            translations: {
              it: "Camicie bambino",
              en: "Shirts",
            },
          },

          {
            code: "boys_jeans",
            slug: "boys-jeans",
            sortOrder: 30,

            translations: {
              it: "Jeans bambino",
              en: "Jeans",
            },
          },
        ],
      },

      {
        code: "kids_girls_clothing",
        slug: "girls-clothing",
        sortOrder: 20,

        translations: {
          it: "Abbigliamento bambina",
          en: "Girls Clothing",
        },

        children: [
          {
            code: "girls_dresses",
            slug: "girls-dresses",
            sortOrder: 10,

            translations: {
              it: "Vestiti bambina",
              en: "Dresses",
            },
          },

          {
            code: "girls_tops",
            slug: "girls-tops",
            sortOrder: 20,

            translations: {
              it: "Top bambina",
              en: "Tops",
            },
          },

          {
            code: "girls_leggings",
            slug: "girls-leggings",
            sortOrder: 30,

            translations: {
              it: "Leggings bambina",
              en: "Leggings",
            },
          },
        ],
      },
    ],
  },

  {
    code: "accessories",
    slug: "accessories",
    sortOrder: 40,

    translations: {
      it: "Accessori",
      en: "Accessories",
    },

    children: [
      {
        code: "bags",
        slug: "bags",
        sortOrder: 10,

        translations: {
          it: "Borse",
          en: "Bags",
        },
      },

      {
        code: "belts",
        slug: "belts",
        sortOrder: 20,

        translations: {
          it: "Cinture",
          en: "Belts",
        },
      },

      {
        code: "wallets",
        slug: "wallets",
        sortOrder: 30,

        translations: {
          it: "Portafogli",
          en: "Wallets",
        },
      },

      {
        code: "fashion_jewellery",
        slug: "fashion-jewellery",
        sortOrder: 40,

        translations: {
          it: "Gioielli moda",
          en: "Fashion Jewellery",
        },
      },
    ],
  },
];

async function seedCategory({
  queryInterface,
  category,
  parentId,
  transaction,
}) {
  const existingRows = await queryInterface.sequelize.query(
    `
        SELECT id
        FROM categories
        WHERE code = :code
        LIMIT 1
      `,
    {
      replacements: {
        code: category.code,
      },

      type: QueryTypes.SELECT,

      transaction,
    },
  );

  let categoryId;

  if (existingRows.length > 0) {
    categoryId = existingRows[0].id;
  } else {
    const now = new Date();

    await queryInterface.bulkInsert(
      "categories",
      [
        {
          parent_id: parentId,

          code: category.code,

          slug: category.slug,

          sort_order: category.sortOrder ?? 0,

          is_active: true,

          created_at: now,

          updated_at: now,

          deleted_at: null,
        },
      ],
      {
        transaction,
      },
    );

    const insertedRows = await queryInterface.sequelize.query(
      `
          SELECT id
          FROM categories
          WHERE code = :code
          LIMIT 1
        `,
      {
        replacements: {
          code: category.code,
        },

        type: QueryTypes.SELECT,

        transaction,
      },
    );

    categoryId = insertedRows[0].id;
  }

  for (const [languageCode, name] of Object.entries(category.translations)) {
    const translationRows = await queryInterface.sequelize.query(
      `
          SELECT id
          FROM category_translations
          WHERE category_id = :categoryId
            AND language_code = :languageCode
          LIMIT 1
        `,
      {
        replacements: {
          categoryId,
          languageCode,
        },

        type: QueryTypes.SELECT,

        transaction,
      },
    );

    if (translationRows.length === 0) {
      const now = new Date();

      await queryInterface.bulkInsert(
        "category_translations",
        [
          {
            category_id: categoryId,

            language_code: languageCode,

            name,

            description: null,

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

  for (const child of category.children ?? []) {
    await seedCategory({
      queryInterface,
      category: child,

      parentId: categoryId,

      transaction,
    });
  }
}

export async function up({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    for (const category of CATEGORY_TREE) {
      await seedCategory({
        queryInterface,
        category,
        parentId: null,
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
  const transaction = await queryInterface.sequelize.transaction();

  try {
    const codes = [];

    function collectCodes(categories) {
      for (const category of categories) {
        codes.push(category.code);

        collectCodes(category.children ?? []);
      }
    }

    collectCodes(CATEGORY_TREE);

    const rows = await queryInterface.sequelize.query(
      `
          SELECT id
          FROM categories
          WHERE code IN (:codes)
        `,
      {
        replacements: {
          codes,
        },

        type: QueryTypes.SELECT,

        transaction,
      },
    );

    const ids = rows.map((row) => row.id);

    if (ids.length > 0) {
      await queryInterface.bulkDelete(
        "category_translations",
        {
          category_id: {
            [Op.in]: ids,
          },
        },
        {
          transaction,
        },
      );

      /*
       * Delete deepest children first.
       */

      const categoryRows = await queryInterface.sequelize.query(
        `
            SELECT id
            FROM categories
            WHERE code IN (:codes)
            ORDER BY id DESC
          `,
        {
          replacements: {
            codes,
          },

          type: QueryTypes.SELECT,

          transaction,
        },
      );

      for (const row of categoryRows) {
        await queryInterface.bulkDelete(
          "categories",
          {
            id: row.id,
          },
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
