import { QueryTypes } from "sequelize";

import {
  connectDatabase,
  disconnectDatabase,
  sequelize,
} from "../config/database.js";

import {
  buildProductImageKey,
  s3ObjectExists,
} from "../services/s3.service.js";

/*
|--------------------------------------------------------------------------
| Starter Vendors
|--------------------------------------------------------------------------
*/

const STARTER_VENDORS = [
  {
    code: "redress_official",

    slug: "redress-official",

    displayName: "Redress Official",

    legalName: "Redress Official",

    email: "official@redress.example",

    commissionValue: "0.00",
  },

  {
    code: "redress_partner_store",

    slug: "redress-partner-store",

    displayName: "Redress Partner Store",

    legalName: "Redress Partner Store",

    email: "partner@redress.example",

    commissionValue: "10.00",
  },
];

/*
|--------------------------------------------------------------------------
| Starter Products
|--------------------------------------------------------------------------
*/

const PRODUCTS = [
  /*
  |--------------------------------------------------------------------------
  | 1. Women's Dress
  |--------------------------------------------------------------------------
  */

  {
    code: "RD-W-DRESS-001",

    slug: "floral-midi-dress",

    vendorCode: "redress_official",

    brandCode: "modaviva",

    categoryCode: "women_dresses",

    fitProfileCode: "regular",

    featured: true,

    translations: {
      en: {
        name: "Floral Midi Dress",

        shortDescription:
          "Elegant floral midi dress with a comfortable regular fit.",

        description:
          "A lightweight floral midi dress designed for everyday styling, dinners and casual occasions.",

        careInstructions: "Machine wash cold with similar colours.",

        sizeAndFitNotes: "Regular fit. Choose your normal size.",

        seoTitle: "Women's Floral Midi Dress",

        seoDescription: "Floral midi dress available in multiple sizes.",
      },

      it: {
        name: "Abito Midi Floreale",

        shortDescription:
          "Elegante abito midi floreale con vestibilità regolare.",

        description:
          "Abito midi leggero con stampa floreale, ideale per occasioni casual e uso quotidiano.",

        careInstructions: "Lavare in lavatrice a freddo con colori simili.",

        sizeAndFitNotes: "Vestibilità regolare. Scegli la tua taglia abituale.",

        seoTitle: "Abito Midi Floreale Donna",

        seoDescription: "Abito midi floreale disponibile in diverse taglie.",
      },
    },

    attributes: {
      fabric: "cotton",

      pattern: "floral",

      sleeve_length: "short_sleeve",

      neck_type: "round_neck",

      occasion: ["casual", "party"],

      closure: "zipper",

      stretchability: "slight_stretch",

      transparency: "opaque",

      dress_shape: "fit_flare",

      dress_length: "midi",
    },

    media: [
      {
        slot: "main",

        sortOrder: 10,

        primary: true,
      },

      {
        slot: "gallery-01",

        sortOrder: 20,

        primary: false,
      },
    ],

    variants: [
      {
        sizeSystem: "alpha",

        size: "S",

        color: "black",

        sku: "RD-W-DRESS-001-BLK-S",

        regularPrice: "79.90",

        salePrice: "69.90",

        costPrice: "32.00",

        stock: 14,

        primary: false,

        measurements: {
          bust_circumference: 88,

          waist_circumference: 72,

          hip_circumference: 96,

          shoulder_width: 36,

          dress_length: 113,
        },
      },

      {
        sizeSystem: "alpha",

        size: "M",

        color: "black",

        sku: "RD-W-DRESS-001-BLK-M",

        regularPrice: "79.90",

        salePrice: "69.90",

        costPrice: "32.00",

        stock: 22,

        primary: true,

        measurements: {
          bust_circumference: 94,

          waist_circumference: 78,

          hip_circumference: 102,

          shoulder_width: 38,

          dress_length: 115,
        },
      },

      {
        sizeSystem: "alpha",

        size: "L",

        color: "black",

        sku: "RD-W-DRESS-001-BLK-L",

        regularPrice: "79.90",

        salePrice: "69.90",

        costPrice: "32.00",

        stock: 16,

        primary: false,

        measurements: {
          bust_circumference: 100,

          waist_circumference: 84,

          hip_circumference: 108,

          shoulder_width: 40,

          dress_length: 117,
        },
      },
    ],
  },

  /*
  |--------------------------------------------------------------------------
  | 2. Women's Jeans
  |--------------------------------------------------------------------------
  */

  {
    code: "RD-W-JEANS-001",

    slug: "women-straight-fit-jeans",

    vendorCode: "redress_partner_store",

    brandCode: "urban_loom",

    categoryCode: "women_jeans",

    fitProfileCode: "regular",

    featured: false,

    translations: {
      en: {
        name: "Straight Fit Jeans",

        shortDescription: "Classic straight-fit jeans in blue denim.",

        description:
          "Comfortable straight-fit denim designed for everyday wear.",

        careInstructions: "Wash inside out in cold water.",

        sizeAndFitNotes: "Mid-rise straight fit.",

        seoTitle: "Women's Straight Fit Jeans",

        seoDescription: "Women's straight-fit jeans in classic blue denim.",
      },

      it: {
        name: "Jeans Donna Vestibilità Dritta",

        shortDescription:
          "Jeans classici in denim blu dalla vestibilità dritta.",

        description:
          "Jeans comodi a vestibilità dritta pensati per l'uso quotidiano.",

        careInstructions: "Lavare al rovescio in acqua fredda.",

        sizeAndFitNotes: "Vita media e vestibilità dritta.",

        seoTitle: "Jeans Donna a Gamba Dritta",

        seoDescription: "Jeans donna a vestibilità dritta in denim blu.",
      },
    },

    attributes: {
      fabric: "denim",

      pattern: "solid",

      waist_rise: "mid",

      closure: "zipper",

      stretchability: "slight_stretch",

      occasion: "casual",
    },

    media: [
      {
        slot: "main",

        sortOrder: 10,

        primary: true,
      },

      {
        slot: "gallery-01",

        sortOrder: 20,

        primary: false,
      },
    ],

    variants: [
      {
        sizeSystem: "waist_in",

        size: "28",

        color: "blue",

        sku: "RD-W-JEANS-001-BLU-28",

        regularPrice: "64.90",

        salePrice: null,

        costPrice: "27.00",

        stock: 15,

        primary: false,

        measurements: {
          waist_circumference: 74,

          hip_circumference: 96,

          thigh_circumference: 56,

          front_rise: 25,

          inseam_length: 76,

          leg_opening: 34,
        },
      },

      {
        sizeSystem: "waist_in",

        size: "30",

        color: "blue",

        sku: "RD-W-JEANS-001-BLU-30",

        regularPrice: "64.90",

        salePrice: null,

        costPrice: "27.00",

        stock: 24,

        primary: true,

        measurements: {
          waist_circumference: 79,

          hip_circumference: 101,

          thigh_circumference: 59,

          front_rise: 26,

          inseam_length: 76,

          leg_opening: 35,
        },
      },

      {
        sizeSystem: "waist_in",

        size: "32",

        color: "blue",

        sku: "RD-W-JEANS-001-BLU-32",

        regularPrice: "64.90",

        salePrice: null,

        costPrice: "27.00",

        stock: 18,

        primary: false,

        measurements: {
          waist_circumference: 84,

          hip_circumference: 106,

          thigh_circumference: 62,

          front_rise: 27,

          inseam_length: 76,

          leg_opening: 36,
        },
      },
    ],
  },

  /*
  |--------------------------------------------------------------------------
  | 3. Men's T-Shirt
  |--------------------------------------------------------------------------
  */

  {
    code: "RD-M-TSHIRT-001",

    slug: "premium-cotton-tshirt",

    vendorCode: "redress_official",

    brandCode: "north_thread",

    categoryCode: "men_tshirts",

    fitProfileCode: "regular",

    featured: true,

    translations: {
      en: {
        name: "Premium Cotton T-Shirt",

        shortDescription: "Soft premium cotton T-shirt for everyday wear.",

        description: "Crew-neck cotton T-shirt designed for everyday comfort.",

        careInstructions: "Machine wash at 30°C.",

        sizeAndFitNotes: "Regular fit.",

        seoTitle: "Men's Premium Cotton T-Shirt",

        seoDescription: "Premium men's cotton T-shirt.",
      },

      it: {
        name: "T-Shirt Premium in Cotone",

        shortDescription:
          "T-shirt morbida in cotone premium per tutti i giorni.",

        description:
          "T-shirt girocollo in cotone pensata per il comfort quotidiano.",

        careInstructions: "Lavare in lavatrice a 30°C.",

        sizeAndFitNotes: "Vestibilità regolare.",

        seoTitle: "T-Shirt Uomo Premium in Cotone",

        seoDescription: "T-shirt uomo premium in cotone.",
      },
    },

    attributes: {
      fabric: "cotton",

      pattern: "solid",

      sleeve_length: "short_sleeve",

      neck_type: "crew_neck",

      occasion: "casual",

      stretchability: "slight_stretch",
    },

    media: [
      {
        slot: "main",

        sortOrder: 10,

        primary: true,
      },

      {
        slot: "gallery-01",

        sortOrder: 20,

        primary: false,
      },
    ],

    variants: [
      {
        sizeSystem: "alpha",

        size: "M",

        color: "white",

        sku: "RD-M-TSHIRT-001-WHT-M",

        regularPrice: "29.90",

        salePrice: null,

        costPrice: "10.50",

        stock: 30,

        primary: true,

        measurements: {
          chest_circumference: 102,

          waist_circumference: 100,

          shoulder_width: 44,

          sleeve_length: 22,

          garment_length: 70,
        },
      },

      {
        sizeSystem: "alpha",

        size: "L",

        color: "white",

        sku: "RD-M-TSHIRT-001-WHT-L",

        regularPrice: "29.90",

        salePrice: null,

        costPrice: "10.50",

        stock: 26,

        primary: false,

        measurements: {
          chest_circumference: 108,

          waist_circumference: 106,

          shoulder_width: 46,

          sleeve_length: 23,

          garment_length: 72,
        },
      },

      {
        sizeSystem: "alpha",

        size: "XL",

        color: "white",

        sku: "RD-M-TSHIRT-001-WHT-XL",

        regularPrice: "29.90",

        salePrice: null,

        costPrice: "10.50",

        stock: 18,

        primary: false,

        measurements: {
          chest_circumference: 114,

          waist_circumference: 112,

          shoulder_width: 48,

          sleeve_length: 24,

          garment_length: 74,
        },
      },
    ],
  },

  /*
  |--------------------------------------------------------------------------
  | 4. Men's Formal Shirt
  |--------------------------------------------------------------------------
  */

  {
    code: "RD-M-SHIRT-001",

    slug: "oxford-formal-shirt",

    vendorCode: "redress_partner_store",

    brandCode: "atelier_nova",

    categoryCode: "men_formal_shirts",

    fitProfileCode: "slim",

    featured: false,

    translations: {
      en: {
        name: "Oxford Formal Shirt",

        shortDescription: "Smart Oxford shirt for work and formal occasions.",

        description:
          "Premium cotton Oxford shirt with structured collar and clean formal finish.",

        careInstructions: "Machine wash at 30°C.",

        sizeAndFitNotes: "Slim fit.",

        seoTitle: "Men's Oxford Formal Shirt",

        seoDescription: "Oxford formal shirt for men.",
      },

      it: {
        name: "Camicia Oxford Formale",

        shortDescription:
          "Camicia Oxford elegante per lavoro e occasioni formali.",

        description:
          "Camicia Oxford premium in cotone con colletto strutturato.",

        careInstructions: "Lavare in lavatrice a 30°C.",

        sizeAndFitNotes: "Vestibilità slim.",

        seoTitle: "Camicia Oxford Formale Uomo",

        seoDescription: "Camicia Oxford formale da uomo.",
      },
    },

    attributes: {
      fabric: "cotton",

      pattern: "solid",

      sleeve_length: "long_sleeve",

      collar_type: "spread",

      closure: "button",

      occasion: "formal",
    },

    media: [
      {
        slot: "main",

        sortOrder: 10,

        primary: true,
      },

      {
        slot: "gallery-01",

        sortOrder: 20,

        primary: false,
      },
    ],

    variants: [
      {
        sizeSystem: "alpha",

        size: "M",

        color: "white",

        sku: "RD-M-SHIRT-001-WHT-M",

        regularPrice: "59.90",

        salePrice: null,

        costPrice: "24.00",

        stock: 20,

        primary: true,

        measurements: {
          chest_circumference: 104,

          waist_circumference: 98,

          shoulder_width: 45,

          sleeve_length: 64,

          garment_length: 74,

          neck_circumference: 39,
        },
      },

      {
        sizeSystem: "alpha",

        size: "L",

        color: "white",

        sku: "RD-M-SHIRT-001-WHT-L",

        regularPrice: "59.90",

        salePrice: null,

        costPrice: "24.00",

        stock: 18,

        primary: false,

        measurements: {
          chest_circumference: 110,

          waist_circumference: 104,

          shoulder_width: 47,

          sleeve_length: 65,

          garment_length: 76,

          neck_circumference: 41,
        },
      },

      {
        sizeSystem: "alpha",

        size: "XL",

        color: "white",

        sku: "RD-M-SHIRT-001-WHT-XL",

        regularPrice: "59.90",

        salePrice: null,

        costPrice: "24.00",

        stock: 12,

        primary: false,

        measurements: {
          chest_circumference: 116,

          waist_circumference: 110,

          shoulder_width: 49,

          sleeve_length: 66,

          garment_length: 78,

          neck_circumference: 43,
        },
      },
    ],
  },

  /*
  |--------------------------------------------------------------------------
  | 5. Girls Dress
  |--------------------------------------------------------------------------
  */

  {
    code: "RD-G-DRESS-001",

    slug: "girls-party-dress",

    vendorCode: "redress_official",

    brandCode: "velora",

    categoryCode: "girls_dresses",

    fitProfileCode: "regular",

    featured: false,

    translations: {
      en: {
        name: "Girls Party Dress",

        shortDescription: "Pretty occasion dress with comfortable kids fit.",

        description:
          "A charming dress designed for celebrations and special occasions.",

        careInstructions: "Gentle machine wash.",

        sizeAndFitNotes: "Regular kids fit.",

        seoTitle: "Girls Party Dress",

        seoDescription: "Elegant party dress for girls.",
      },

      it: {
        name: "Abito da Festa Bambina",

        shortDescription:
          "Elegante abito da occasione con vestibilità confortevole.",

        description:
          "Grazioso abito pensato per celebrazioni ed eventi speciali.",

        careInstructions: "Lavaggio delicato in lavatrice.",

        sizeAndFitNotes: "Vestibilità regolare bambina.",

        seoTitle: "Abito da Festa Bambina",

        seoDescription: "Elegante abito da festa per bambina.",
      },
    },

    attributes: {
      fabric: "polyester",

      pattern: "floral",

      sleeve_length: "short_sleeve",

      neck_type: "round_neck",

      closure: "zipper",

      dress_shape: "fit_flare",

      dress_length: "knee",

      occasion: "party",
    },

    media: [
      {
        slot: "main",

        sortOrder: 10,

        primary: true,
      },

      {
        slot: "gallery-01",

        sortOrder: 20,

        primary: false,
      },
    ],

    variants: [
      {
        sizeSystem: "kids_age",

        size: "5-6Y",

        color: "pink",

        sku: "RD-G-DRESS-001-PNK-5-6Y",

        regularPrice: "49.90",

        salePrice: "44.90",

        costPrice: "19.00",

        stock: 12,

        primary: false,

        measurements: {
          bust_circumference: 66,

          waist_circumference: 62,

          hip_circumference: 72,

          shoulder_width: 28,

          dress_length: 72,
        },
      },

      {
        sizeSystem: "kids_age",

        size: "6-7Y",

        color: "pink",

        sku: "RD-G-DRESS-001-PNK-6-7Y",

        regularPrice: "49.90",

        salePrice: "44.90",

        costPrice: "19.00",

        stock: 18,

        primary: true,

        measurements: {
          bust_circumference: 70,

          waist_circumference: 64,

          hip_circumference: 76,

          shoulder_width: 30,

          dress_length: 76,
        },
      },

      {
        sizeSystem: "kids_age",

        size: "7-8Y",

        color: "pink",

        sku: "RD-G-DRESS-001-PNK-7-8Y",

        regularPrice: "49.90",

        salePrice: "44.90",

        costPrice: "19.00",

        stock: 12,

        primary: false,

        measurements: {
          bust_circumference: 74,

          waist_circumference: 66,

          hip_circumference: 80,

          shoulder_width: 32,

          dress_length: 80,
        },
      },
    ],
  },

  /*
  |--------------------------------------------------------------------------
  | 6. Women's Block Heels
  |--------------------------------------------------------------------------
  */

  {
    code: "RD-W-HEEL-001",

    slug: "classic-block-heels",

    vendorCode: "redress_partner_store",

    brandCode: "atelier_nova",

    categoryCode: "women_heels",

    fitProfileCode: null,

    featured: false,

    translations: {
      en: {
        name: "Classic Block Heels",

        shortDescription: "Elegant block heels for day-to-evening styling.",

        description:
          "Comfortable classic block heels suitable for office and occasion wear.",

        careInstructions: "Wipe clean with a soft dry cloth.",

        sizeAndFitNotes: "Standard EU footwear sizing.",

        seoTitle: "Women's Classic Block Heels",

        seoDescription: "Elegant women's block heels.",
      },

      it: {
        name: "Décolleté con Tacco Largo",

        shortDescription: "Eleganti scarpe con tacco largo.",

        description:
          "Scarpe con tacco largo ideali per lavoro e occasioni speciali.",

        careInstructions: "Pulire con un panno morbido e asciutto.",

        sizeAndFitNotes: "Taglie standard europee.",

        seoTitle: "Scarpe Donna con Tacco Largo",

        seoDescription: "Eleganti scarpe donna con tacco largo.",
      },
    },

    attributes: {
      upper_material: "faux_leather",

      sole_material: "rubber",

      heel_type: "block",

      heel_height_cm: {
        decimal: 6.5,

        unit: "cm",
      },

      toe_shape: "pointed",

      closure: "buckle",

      shoe_width: "standard",

      occasion: ["formal", "party"],
    },

    media: [
      {
        slot: "main",

        sortOrder: 10,

        primary: true,
      },

      {
        slot: "gallery-01",

        sortOrder: 20,

        primary: false,
      },
    ],

    variants: [
      {
        sizeSystem: "eu_footwear",

        size: "37",

        color: "black",

        sku: "RD-W-HEEL-001-BLK-37",

        regularPrice: "84.90",

        salePrice: null,

        costPrice: "34.00",

        stock: 10,

        primary: false,

        measurements: {},
      },

      {
        sizeSystem: "eu_footwear",

        size: "38",

        color: "black",

        sku: "RD-W-HEEL-001-BLK-38",

        regularPrice: "84.90",

        salePrice: null,

        costPrice: "34.00",

        stock: 15,

        primary: true,

        measurements: {},
      },

      {
        sizeSystem: "eu_footwear",

        size: "39",

        color: "black",

        sku: "RD-W-HEEL-001-BLK-39",

        regularPrice: "84.90",

        salePrice: null,

        costPrice: "34.00",

        stock: 11,

        primary: false,

        measurements: {},
      },
    ],
  },
];

/*
|--------------------------------------------------------------------------
| Query Helpers
|--------------------------------------------------------------------------
*/

async function selectOne(sql, replacements, transaction) {
  const rows = await sequelize.query(sql, {
    replacements,

    type: QueryTypes.SELECT,

    transaction,
  });

  return rows[0] ?? null;
}

async function getIdByCode(table, code, transaction) {
  const row = await selectOne(
    `
        SELECT id
        FROM ${table}
        WHERE code = :code
        LIMIT 1
      `,
    {
      code,
    },
    transaction,
  );

  if (!row?.id) {
    throw new Error(`${table} record not found: ${code}`);
  }

  return row.id;
}

async function getSuperAdminId(transaction) {
  const row = await selectOne(
    `
        SELECT a.id

        FROM accounts a

        INNER JOIN account_roles ar
          ON ar.account_id = a.id

        INNER JOIN roles r
          ON r.id = ar.role_id

        WHERE r.code = 'super_admin'
          AND a.status = 'active'

        ORDER BY a.id ASC

        LIMIT 1
      `,
    {},
    transaction,
  );

  if (!row?.id) {
    throw new Error("Active super_admin account was not found.");
  }

  return row.id;
}

async function getSizeId(sizeSystem, size, transaction) {
  const row = await selectOne(
    `
        SELECT s.id

        FROM sizes s

        INNER JOIN size_systems ss
          ON ss.id = s.size_system_id

        WHERE ss.code = :sizeSystem
          AND s.code = :size

        LIMIT 1
      `,
    {
      sizeSystem,
      size,
    },
    transaction,
  );

  if (!row?.id) {
    throw new Error(`Size not found: ${sizeSystem}/${size}`);
  }

  return row.id;
}

async function getAttribute(code, transaction) {
  const row = await selectOne(
    `
        SELECT
          id,
          data_type

        FROM attributes

        WHERE code = :code

        LIMIT 1
      `,
    {
      code,
    },
    transaction,
  );

  if (!row?.id) {
    throw new Error(`Attribute not found: ${code}`);
  }

  return row;
}

async function getAttributeValueId(attributeId, valueCode, transaction) {
  const row = await selectOne(
    `
        SELECT id

        FROM attribute_values

        WHERE attribute_id = :attributeId
          AND code = :valueCode

        LIMIT 1
      `,
    {
      attributeId,
      valueCode,
    },
    transaction,
  );

  if (!row?.id) {
    throw new Error(`Attribute value not found: ${valueCode}`);
  }

  return row.id;
}

async function getMeasurementTypeId(code, transaction) {
  const row = await selectOne(
    `
        SELECT id

        FROM garment_measurement_types

        WHERE code = :code

        LIMIT 1
      `,
    {
      code,
    },
    transaction,
  );

  if (!row?.id) {
    throw new Error(`Measurement type not found: ${code}`);
  }

  return row.id;
}

/*
|--------------------------------------------------------------------------
| Vendor
|--------------------------------------------------------------------------
*/

async function ensureVendor(vendor, transaction) {
  let row = await selectOne(
    `
        SELECT id

        FROM vendors

        WHERE code = :code

        LIMIT 1
      `,
    {
      code: vendor.code,
    },
    transaction,
  );

  if (row?.id) {
    return row.id;
  }

  const now = new Date();

  await sequelize.getQueryInterface().bulkInsert(
    "vendors",
    [
      {
        code: vendor.code,

        slug: vendor.slug,

        display_name: vendor.displayName,

        legal_name: vendor.legalName,

        email: vendor.email,

        phone: null,

        status: "active",

        approval_status: "approved",

        commission_type: "percentage",

        commission_value: vendor.commissionValue,

        default_currency_code: "EUR",

        country_code: "IT",

        tax_identifier: null,

        registration_number: null,

        website_url: null,

        logo_key: null,

        approved_at: now,

        suspended_at: null,

        created_at: now,

        updated_at: now,

        deleted_at: null,
      },
    ],
    {
      transaction,
    },
  );

  row = await selectOne(
    `
        SELECT id

        FROM vendors

        WHERE code = :code

        LIMIT 1
      `,
    {
      code: vendor.code,
    },
    transaction,
  );

  return row.id;
}

/*
|--------------------------------------------------------------------------
| Product Attribute
|--------------------------------------------------------------------------
*/

async function ensureProductAttribute({
  productId,
  attributeCode,
  value,
  transaction,
}) {
  const attribute = await getAttribute(attributeCode, transaction);

  const values = Array.isArray(value) ? value : [value];

  for (const item of values) {
    let attributeValueId = null;

    let valueText = null;

    let valueDecimal = null;

    let valueBoolean = null;

    let unitCode = null;

    if (typeof item === "string") {
      attributeValueId = await getAttributeValueId(
        attribute.id,
        item,
        transaction,
      );
    } else if (typeof item === "number") {
      valueDecimal = item;
    } else if (typeof item === "boolean") {
      valueBoolean = item;
    } else if (item && typeof item === "object") {
      if (item.decimal !== undefined) {
        valueDecimal = item.decimal;
      }

      if (item.text !== undefined) {
        valueText = item.text;
      }

      if (item.boolean !== undefined) {
        valueBoolean = item.boolean;
      }

      unitCode = item.unit ?? null;
    }

    let existing;

    if (attributeValueId) {
      existing = await selectOne(
        `
            SELECT id

            FROM product_attribute_values

            WHERE product_id = :productId
              AND variant_id IS NULL
              AND attribute_id = :attributeId
              AND attribute_value_id = :attributeValueId

            LIMIT 1
          `,
        {
          productId,

          attributeId: attribute.id,

          attributeValueId,
        },
        transaction,
      );
    } else {
      existing = await selectOne(
        `
            SELECT id

            FROM product_attribute_values

            WHERE product_id = :productId
              AND variant_id IS NULL
              AND attribute_id = :attributeId
              AND attribute_value_id IS NULL

            LIMIT 1
          `,
        {
          productId,

          attributeId: attribute.id,
        },
        transaction,
      );
    }

    if (existing?.id) {
      continue;
    }

    const now = new Date();

    await sequelize.getQueryInterface().bulkInsert(
      "product_attribute_values",
      [
        {
          product_id: productId,

          variant_id: null,

          attribute_id: attribute.id,

          attribute_value_id: attributeValueId,

          value_text: valueText,

          value_decimal: valueDecimal,

          value_boolean: valueBoolean,

          unit_code: unitCode,

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

/*
|--------------------------------------------------------------------------
| S3 Verification
|--------------------------------------------------------------------------
*/

async function verifyProductImages() {
  console.log("Verifying starter product images in S3...");

  for (const product of PRODUCTS) {
    for (const media of product.media) {
      const key = buildProductImageKey(product.code, media.slot);

      const exists = await s3ObjectExists(key);

      if (!exists) {
        throw new Error(
          [
            "Starter product image does not exist in S3:",
            key,
            "",
            "Run:",
            "npm run storage:upload:starter",
            "",
            "before seeding starter products.",
          ].join("\n"),
        );
      }
    }
  }

  console.log("All required S3 images found ✅");
}

/*
|--------------------------------------------------------------------------
| Seed Products
|--------------------------------------------------------------------------
*/

async function seedProducts() {
  await connectDatabase();

  const queryInterface = sequelize.getQueryInterface();

  const transaction = await sequelize.transaction();

  try {
    const superAdminId = await getSuperAdminId(transaction);

    const vendorIds = {};

    for (const vendor of STARTER_VENDORS) {
      vendorIds[vendor.code] = await ensureVendor(vendor, transaction);
    }

    for (const product of PRODUCTS) {
      console.log(`Seeding ${product.code} ...`);

      const vendorId = vendorIds[product.vendorCode];

      const brandId = await getIdByCode(
        "brands",
        product.brandCode,
        transaction,
      );

      const categoryId = await getIdByCode(
        "categories",
        product.categoryCode,
        transaction,
      );

      const fitProfileId = product.fitProfileCode
        ? await getIdByCode("fit_profiles", product.fitProfileCode, transaction)
        : null;

      let productRow = await selectOne(
        `
            SELECT id

            FROM products

            WHERE code = :code

            LIMIT 1
          `,
        {
          code: product.code,
        },
        transaction,
      );

      const now = new Date();

      /*
      |--------------------------------------------------------------------------
      | Product
      |--------------------------------------------------------------------------
      */

      if (!productRow?.id) {
        await queryInterface.bulkInsert(
          "products",
          [
            {
              vendor_id: vendorId,

              brand_id: brandId,

              fit_profile_id: fitProfileId,

              code: product.code,

              slug: product.slug,

              status: "published",

              approval_status: "approved",

              visibility: "public",

              currency_code: "EUR",

              is_featured: product.featured,

              is_returnable: true,

              return_window_days: 30,

              rejection_reason: null,

              published_at: now,

              approved_at: now,

              created_by_account_id: superAdminId,

              approved_by_account_id: superAdminId,

              created_at: now,

              updated_at: now,

              deleted_at: null,
            },
          ],
          {
            transaction,
          },
        );

        productRow = await selectOne(
          `
              SELECT id

              FROM products

              WHERE code = :code

              LIMIT 1
            `,
          {
            code: product.code,
          },
          transaction,
        );
      }

      const productId = productRow.id;

      /*
      |--------------------------------------------------------------------------
      | Translations
      |--------------------------------------------------------------------------
      */

      for (const [languageCode, translation] of Object.entries(
        product.translations,
      )) {
        const existing = await selectOne(
          `
              SELECT id

              FROM product_translations

              WHERE product_id = :productId
                AND language_code = :languageCode

              LIMIT 1
            `,
          {
            productId,
            languageCode,
          },
          transaction,
        );

        if (existing?.id) {
          continue;
        }

        await queryInterface.bulkInsert(
          "product_translations",
          [
            {
              product_id: productId,

              language_code: languageCode,

              name: translation.name,

              short_description: translation.shortDescription,

              description: translation.description,

              care_instructions: translation.careInstructions,

              size_and_fit_notes: translation.sizeAndFitNotes,

              seo_title: translation.seoTitle,

              seo_description: translation.seoDescription,

              created_at: now,

              updated_at: now,
            },
          ],
          {
            transaction,
          },
        );
      }

      /*
      |--------------------------------------------------------------------------
      | Category
      |--------------------------------------------------------------------------
      */

      const existingCategory = await selectOne(
        `
            SELECT id

            FROM product_categories

            WHERE product_id = :productId
              AND category_id = :categoryId

            LIMIT 1
          `,
        {
          productId,
          categoryId,
        },
        transaction,
      );

      if (!existingCategory?.id) {
        await queryInterface.bulkInsert(
          "product_categories",
          [
            {
              product_id: productId,

              category_id: categoryId,

              is_primary: true,

              sort_order: 10,

              created_at: now,

              updated_at: now,
            },
          ],
          {
            transaction,
          },
        );
      }

      /*
      |--------------------------------------------------------------------------
      | Attributes
      |--------------------------------------------------------------------------
      */

      for (const [attributeCode, value] of Object.entries(product.attributes)) {
        await ensureProductAttribute({
          productId,

          attributeCode,

          value,

          transaction,
        });
      }

      /*
      |--------------------------------------------------------------------------
      | Variants
      |--------------------------------------------------------------------------
      */

      for (const [variantIndex, variant] of product.variants.entries()) {
        const sizeId = await getSizeId(
          variant.sizeSystem,
          variant.size,
          transaction,
        );

        const colorId = await getIdByCode("colors", variant.color, transaction);

        let variantRow = await selectOne(
          `
              SELECT id

              FROM product_variants

              WHERE sku = :sku

              LIMIT 1
            `,
          {
            sku: variant.sku,
          },
          transaction,
        );

        if (!variantRow?.id) {
          await queryInterface.bulkInsert(
            "product_variants",
            [
              {
                product_id: productId,

                size_id: sizeId,

                color_id: colorId,

                sku: variant.sku,

                barcode: null,

                regular_price: variant.regularPrice,

                sale_price: variant.salePrice,

                cost_price: variant.costPrice,

                sale_start_at: null,

                sale_end_at: null,

                weight_value: null,

                weight_unit: null,

                is_default: variant.primary,

                is_active: true,

                sort_order: (variantIndex + 1) * 10,

                created_at: now,

                updated_at: now,

                deleted_at: null,
              },
            ],
            {
              transaction,
            },
          );

          variantRow = await selectOne(
            `
                SELECT id

                FROM product_variants

                WHERE sku = :sku

                LIMIT 1
              `,
            {
              sku: variant.sku,
            },
            transaction,
          );
        }

        const variantId = variantRow.id;

        /*
        |--------------------------------------------------------------------------
        | Inventory
        |--------------------------------------------------------------------------
        */

        const existingInventory = await selectOne(
          `
              SELECT id

              FROM inventory

              WHERE variant_id = :variantId

              LIMIT 1
            `,
          {
            variantId,
          },
          transaction,
        );

        if (!existingInventory?.id) {
          await queryInterface.bulkInsert(
            "inventory",
            [
              {
                variant_id: variantId,

                quantity_on_hand: variant.stock,

                quantity_reserved: 0,

                reorder_point: 5,

                safety_stock: 2,

                allow_backorder: false,

                stock_version: 0,

                created_at: now,

                updated_at: now,
              },
            ],
            {
              transaction,
            },
          );
        }

        /*
        |--------------------------------------------------------------------------
        | Garment Measurements
        |--------------------------------------------------------------------------
        */

        for (const [measurementCode, valueCm] of Object.entries(
          variant.measurements ?? {},
        )) {
          const measurementTypeId = await getMeasurementTypeId(
            measurementCode,
            transaction,
          );

          const existingMeasurement = await selectOne(
            `
                SELECT id

                FROM garment_measurements

                WHERE variant_id = :variantId
                  AND measurement_type_id = :measurementTypeId

                LIMIT 1
              `,
            {
              variantId,
              measurementTypeId,
            },
            transaction,
          );

          if (existingMeasurement?.id) {
            continue;
          }

          await queryInterface.bulkInsert(
            "garment_measurements",
            [
              {
                variant_id: variantId,

                measurement_type_id: measurementTypeId,

                value_cm: valueCm,

                tolerance_plus_cm: 0,

                tolerance_minus_cm: 0,

                source: "import",

                is_estimated: false,

                notes: "Initial starter catalogue measurement",

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

      /*
      |--------------------------------------------------------------------------
      | S3 Media
      |--------------------------------------------------------------------------
      */

      for (const media of product.media) {
        const storageKey = buildProductImageKey(product.code, media.slot);

        const existingMedia = await selectOne(
          `
              SELECT id

              FROM product_media

              WHERE product_id = :productId
                AND storage_key = :storageKey

              LIMIT 1
            `,
          {
            productId,
            storageKey,
          },
          transaction,
        );

        if (existingMedia?.id) {
          continue;
        }

        await queryInterface.bulkInsert(
          "product_media",
          [
            {
              product_id: productId,

              variant_id: null,

              media_type: "image",

              storage_key: storageKey,

              mime_type: "image/webp",

              alt_text: product.translations.en.name,

              /*
               * Exact optimized dimensions are not guessed.
               *
               * Runtime/admin upload APIs will save actual dimensions.
               */
              width: null,

              height: null,

              duration_seconds: null,

              sort_order: media.sortOrder,

              is_primary: media.primary,

              moderation_status: "approved",

              approved_at: now,

              created_at: now,

              updated_at: now,

              deleted_at: null,
            },
          ],
          {
            transaction,
          },
        );
      }
    }

    await transaction.commit();

    console.log("");

    console.log("Starter products seeded successfully ✅");
  } catch (error) {
    await transaction.rollback();

    throw error;
  }
}

/*
|--------------------------------------------------------------------------
| Main
|--------------------------------------------------------------------------
*/

async function run() {
  try {
    /*
     * Important:
     *
     * Verify S3 BEFORE opening the database transaction.
     *
     * We never want DB product media records pointing at missing objects.
     */
    await verifyProductImages();

    await seedProducts();
  } catch (error) {
    console.error("");

    console.error("Starter product seed failed ❌");

    console.error(error?.message ?? error);

    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
}

await run();
