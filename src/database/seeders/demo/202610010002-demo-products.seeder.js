import { Op, QueryTypes } from "sequelize";

import { buildProductImageKey } from "../../../services/s3.service.js";

/*
|--------------------------------------------------------------------------
| Initial Redress Demo Products
|--------------------------------------------------------------------------
|
| These products exist only to provide realistic initial data for:
|
| - Customer web/app
| - Admin panel
| - Vendor panel
| - Product cards
| - Category filters
| - Brand filters
| - Size/color variants
| - Pricing
| - Inventory
|
*/

const PRODUCTS = [
  {
    code: "RD-W-DRESS-001",
    slug: "floral-midi-dress",

    vendorCode: "modaviva_official",

    brandCode: "modaviva",

    categoryCode: "women_dresses",

    fitProfileCode: "regular",

    translations: {
      en: {
        name: "Floral Midi Dress",

        shortDescription:
          "Elegant floral midi dress with a comfortable everyday fit.",

        description:
          "A lightweight floral midi dress designed for casual outings, dinners and everyday styling.",

        careInstructions: "Machine wash cold. Wash with similar colours.",

        sizeAndFitNotes: "Regular fit. Choose your usual size.",

        seoTitle: "Women's Floral Midi Dress",

        seoDescription:
          "Shop the Floral Midi Dress in multiple colours and sizes.",
      },

      it: {
        name: "Abito Midi Floreale",

        shortDescription:
          "Elegante abito midi floreale con vestibilità comoda.",

        description:
          "Un abito midi leggero con stampa floreale, ideale per occasioni casual e uso quotidiano.",

        careInstructions: "Lavare in lavatrice a freddo con colori simili.",

        sizeAndFitNotes: "Vestibilità regolare. Scegli la tua taglia abituale.",

        seoTitle: "Abito Midi Floreale da Donna",

        seoDescription:
          "Scopri l'abito midi floreale disponibile in più colori e taglie.",
      },
    },

    variants: [
      {
        sizeSystem: "alpha",
        size: "S",
        color: "black",
        sku: "RD-W-DRESS-001-BLK-S",
        regularPrice: "79.90",
        salePrice: "69.90",
        costPrice: "32.00",
        stock: 16,
      },
      {
        sizeSystem: "alpha",
        size: "M",
        color: "black",
        sku: "RD-W-DRESS-001-BLK-M",
        regularPrice: "79.90",
        salePrice: "69.90",
        costPrice: "32.00",
        stock: 24,
        isDefault: true,
      },
      {
        sizeSystem: "alpha",
        size: "L",
        color: "black",
        sku: "RD-W-DRESS-001-BLK-L",
        regularPrice: "79.90",
        salePrice: "69.90",
        costPrice: "32.00",
        stock: 18,
      },
      {
        sizeSystem: "alpha",
        size: "S",
        color: "red",
        sku: "RD-W-DRESS-001-RED-S",
        regularPrice: "79.90",
        salePrice: "69.90",
        costPrice: "32.00",
        stock: 10,
      },
      {
        sizeSystem: "alpha",
        size: "M",
        color: "red",
        sku: "RD-W-DRESS-001-RED-M",
        regularPrice: "79.90",
        salePrice: "69.90",
        costPrice: "32.00",
        stock: 14,
      },
      {
        sizeSystem: "alpha",
        size: "L",
        color: "red",
        sku: "RD-W-DRESS-001-RED-L",
        regularPrice: "79.90",
        salePrice: "69.90",
        costPrice: "32.00",
        stock: 8,
      },
    ],
  },

  {
    code: "RD-W-TOP-001",
    slug: "ribbed-knit-top",

    vendorCode: "redress_demo_store",

    brandCode: "velora",

    categoryCode: "women_tops",

    fitProfileCode: "slim",

    translations: {
      en: {
        name: "Ribbed Knit Top",

        shortDescription: "Soft ribbed knit top with a flattering slim fit.",

        description:
          "A versatile ribbed top designed for casual layering and everyday outfits.",

        careInstructions: "Gentle machine wash. Dry flat.",

        sizeAndFitNotes: "Slim fit with stretch.",

        seoTitle: "Women's Ribbed Knit Top",

        seoDescription:
          "Shop the women's Ribbed Knit Top in versatile everyday colours.",
      },

      it: {
        name: "Top in Maglia a Coste",

        shortDescription: "Top morbido a coste con vestibilità aderente.",

        description:
          "Un top versatile in maglia a coste, ideale per outfit casual e quotidiani.",

        careInstructions: "Lavaggio delicato in lavatrice. Asciugare in piano.",

        sizeAndFitNotes: "Vestibilità aderente con tessuto elasticizzato.",

        seoTitle: "Top Donna in Maglia a Coste",

        seoDescription:
          "Scopri il top da donna in maglia a coste disponibile in diversi colori.",
      },
    },

    variants: [
      {
        sizeSystem: "alpha",
        size: "S",
        color: "beige",
        sku: "RD-W-TOP-001-BGE-S",
        regularPrice: "39.90",
        salePrice: "34.90",
        costPrice: "14.00",
        stock: 20,
      },
      {
        sizeSystem: "alpha",
        size: "M",
        color: "beige",
        sku: "RD-W-TOP-001-BGE-M",
        regularPrice: "39.90",
        salePrice: "34.90",
        costPrice: "14.00",
        stock: 28,
        isDefault: true,
      },
      {
        sizeSystem: "alpha",
        size: "L",
        color: "beige",
        sku: "RD-W-TOP-001-BGE-L",
        regularPrice: "39.90",
        salePrice: "34.90",
        costPrice: "14.00",
        stock: 22,
      },
      {
        sizeSystem: "alpha",
        size: "S",
        color: "black",
        sku: "RD-W-TOP-001-BLK-S",
        regularPrice: "39.90",
        salePrice: null,
        costPrice: "14.00",
        stock: 18,
      },
      {
        sizeSystem: "alpha",
        size: "M",
        color: "black",
        sku: "RD-W-TOP-001-BLK-M",
        regularPrice: "39.90",
        salePrice: null,
        costPrice: "14.00",
        stock: 26,
      },
      {
        sizeSystem: "alpha",
        size: "L",
        color: "black",
        sku: "RD-W-TOP-001-BLK-L",
        regularPrice: "39.90",
        salePrice: null,
        costPrice: "14.00",
        stock: 19,
      },
    ],
  },

  {
    code: "RD-W-JEANS-001",
    slug: "women-straight-fit-jeans",

    vendorCode: "redress_demo_store",

    brandCode: "urban_loom",

    categoryCode: "women_jeans",

    fitProfileCode: "regular",

    translations: {
      en: {
        name: "Straight Fit Jeans",

        shortDescription: "Classic straight-leg denim for everyday wear.",

        description:
          "Comfortable mid-rise straight-fit jeans designed for versatile daily styling.",

        careInstructions: "Wash inside out with similar colours.",

        sizeAndFitNotes: "Straight fit with regular waist.",

        seoTitle: "Women's Straight Fit Jeans",

        seoDescription:
          "Shop women's straight fit jeans in classic blue denim.",
      },

      it: {
        name: "Jeans Donna Vestibilità Dritta",

        shortDescription: "Jeans classici a gamba dritta per tutti i giorni.",

        description:
          "Jeans a vita media con vestibilità dritta, comodi e versatili.",

        careInstructions: "Lavare al rovescio con colori simili.",

        sizeAndFitNotes: "Vestibilità dritta con vita regolare.",

        seoTitle: "Jeans Donna a Gamba Dritta",

        seoDescription:
          "Scopri i jeans donna a vestibilità dritta in denim blu.",
      },
    },

    variants: [
      {
        sizeSystem: "waist_in",
        size: "26",
        color: "blue",
        sku: "RD-W-JEANS-001-BLU-26",
        regularPrice: "64.90",
        salePrice: null,
        costPrice: "27.00",
        stock: 12,
      },
      {
        sizeSystem: "waist_in",
        size: "28",
        color: "blue",
        sku: "RD-W-JEANS-001-BLU-28",
        regularPrice: "64.90",
        salePrice: null,
        costPrice: "27.00",
        stock: 18,
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
        isDefault: true,
      },
      {
        sizeSystem: "waist_in",
        size: "32",
        color: "blue",
        sku: "RD-W-JEANS-001-BLU-32",
        regularPrice: "64.90",
        salePrice: null,
        costPrice: "27.00",
        stock: 20,
      },
      {
        sizeSystem: "waist_in",
        size: "34",
        color: "blue",
        sku: "RD-W-JEANS-001-BLU-34",
        regularPrice: "64.90",
        salePrice: null,
        costPrice: "27.00",
        stock: 14,
      },
    ],
  },

  {
    code: "RD-W-HEEL-001",
    slug: "classic-block-heels",

    vendorCode: "modaviva_official",

    brandCode: "atelier_nova",

    categoryCode: "women_heels",

    fitProfileCode: null,

    translations: {
      en: {
        name: "Classic Block Heels",

        shortDescription:
          "Elegant block heels designed for day-to-evening styling.",

        description:
          "Comfortable block heels with a timeless silhouette suitable for work and occasions.",

        careInstructions: "Wipe clean with a soft dry cloth.",

        sizeAndFitNotes: "Standard EU footwear sizing.",

        seoTitle: "Women's Classic Block Heels",

        seoDescription: "Shop elegant women's block heels in classic black.",
      },

      it: {
        name: "Décolleté con Tacco Largo",

        shortDescription:
          "Eleganti scarpe con tacco largo per il giorno e la sera.",

        description:
          "Scarpe con tacco largo dal design classico, ideali per lavoro e occasioni speciali.",

        careInstructions: "Pulire con un panno morbido e asciutto.",

        sizeAndFitNotes: "Taglie standard europee.",

        seoTitle: "Scarpe Donna con Tacco Largo",

        seoDescription:
          "Scopri le eleganti scarpe donna con tacco largo in nero.",
      },
    },

    variants: [
      {
        sizeSystem: "eu_footwear",
        size: "36",
        color: "black",
        sku: "RD-W-HEEL-001-BLK-36",
        regularPrice: "84.90",
        salePrice: null,
        costPrice: "34.00",
        stock: 8,
      },
      {
        sizeSystem: "eu_footwear",
        size: "37",
        color: "black",
        sku: "RD-W-HEEL-001-BLK-37",
        regularPrice: "84.90",
        salePrice: null,
        costPrice: "34.00",
        stock: 10,
      },
      {
        sizeSystem: "eu_footwear",
        size: "38",
        color: "black",
        sku: "RD-W-HEEL-001-BLK-38",
        regularPrice: "84.90",
        salePrice: null,
        costPrice: "34.00",
        stock: 14,
        isDefault: true,
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
      },
      {
        sizeSystem: "eu_footwear",
        size: "40",
        color: "black",
        sku: "RD-W-HEEL-001-BLK-40",
        regularPrice: "84.90",
        salePrice: null,
        costPrice: "34.00",
        stock: 7,
      },
    ],
  },

  {
    code: "RD-M-TSHIRT-001",
    slug: "premium-cotton-tshirt",

    vendorCode: "redress_demo_store",

    brandCode: "north_thread",

    categoryCode: "men_tshirts",

    fitProfileCode: "regular",

    translations: {
      en: {
        name: "Premium Cotton T-Shirt",

        shortDescription:
          "Soft premium cotton T-shirt with a clean everyday design.",

        description:
          "A versatile crew-neck cotton T-shirt made for daily comfort and easy layering.",

        careInstructions: "Machine wash at 30°C.",

        sizeAndFitNotes: "Regular fit.",

        seoTitle: "Men's Premium Cotton T-Shirt",

        seoDescription:
          "Shop premium men's cotton T-shirts in essential colours.",
      },

      it: {
        name: "T-Shirt Premium in Cotone",

        shortDescription:
          "T-shirt morbida in cotone premium dal design essenziale.",

        description:
          "T-shirt girocollo versatile, pensata per comfort quotidiano e facile abbinamento.",

        careInstructions: "Lavare in lavatrice a 30°C.",

        sizeAndFitNotes: "Vestibilità regolare.",

        seoTitle: "T-Shirt Uomo Premium in Cotone",

        seoDescription:
          "Scopri le T-shirt uomo premium in cotone nei colori essenziali.",
      },
    },

    variants: [
      {
        sizeSystem: "alpha",
        size: "S",
        color: "white",
        sku: "RD-M-TSHIRT-001-WHT-S",
        regularPrice: "29.90",
        salePrice: null,
        costPrice: "10.50",
        stock: 32,
      },
      {
        sizeSystem: "alpha",
        size: "M",
        color: "white",
        sku: "RD-M-TSHIRT-001-WHT-M",
        regularPrice: "29.90",
        salePrice: null,
        costPrice: "10.50",
        stock: 40,
        isDefault: true,
      },
      {
        sizeSystem: "alpha",
        size: "L",
        color: "white",
        sku: "RD-M-TSHIRT-001-WHT-L",
        regularPrice: "29.90",
        salePrice: null,
        costPrice: "10.50",
        stock: 36,
      },
      {
        sizeSystem: "alpha",
        size: "XL",
        color: "white",
        sku: "RD-M-TSHIRT-001-WHT-XL",
        regularPrice: "29.90",
        salePrice: null,
        costPrice: "10.50",
        stock: 20,
      },
      {
        sizeSystem: "alpha",
        size: "M",
        color: "navy",
        sku: "RD-M-TSHIRT-001-NVY-M",
        regularPrice: "29.90",
        salePrice: "24.90",
        costPrice: "10.50",
        stock: 30,
      },
      {
        sizeSystem: "alpha",
        size: "L",
        color: "navy",
        sku: "RD-M-TSHIRT-001-NVY-L",
        regularPrice: "29.90",
        salePrice: "24.90",
        costPrice: "10.50",
        stock: 28,
      },
    ],
  },

  {
    code: "RD-M-SHIRT-001",
    slug: "oxford-formal-shirt",

    vendorCode: "modaviva_official",

    brandCode: "atelier_nova",

    categoryCode: "men_formal_shirts",

    fitProfileCode: "slim",

    translations: {
      en: {
        name: "Oxford Formal Shirt",

        shortDescription:
          "Smart Oxford shirt tailored for work and formal occasions.",

        description:
          "A refined cotton Oxford shirt with a structured collar and clean formal finish.",

        careInstructions: "Machine wash at 30°C. Warm iron.",

        sizeAndFitNotes: "Slim fit. Size up for a relaxed fit.",

        seoTitle: "Men's Oxford Formal Shirt",

        seoDescription:
          "Shop men's Oxford formal shirts for office and occasion wear.",
      },

      it: {
        name: "Camicia Oxford Formale",

        shortDescription:
          "Camicia Oxford elegante per lavoro e occasioni formali.",

        description:
          "Camicia Oxford raffinata in cotone con colletto strutturato e finitura formale.",

        careInstructions: "Lavare a 30°C. Stirare a temperatura media.",

        sizeAndFitNotes:
          "Vestibilità slim. Scegli una taglia in più per una vestibilità più morbida.",

        seoTitle: "Camicia Oxford Formale Uomo",

        seoDescription:
          "Scopri le camicie Oxford formali da uomo per ufficio e occasioni.",
      },
    },

    variants: [
      {
        sizeSystem: "alpha",
        size: "M",
        color: "white",
        sku: "RD-M-SHIRT-001-WHT-M",
        regularPrice: "59.90",
        salePrice: null,
        costPrice: "24.00",
        stock: 22,
        isDefault: true,
      },
      {
        sizeSystem: "alpha",
        size: "L",
        color: "white",
        sku: "RD-M-SHIRT-001-WHT-L",
        regularPrice: "59.90",
        salePrice: null,
        costPrice: "24.00",
        stock: 20,
      },
      {
        sizeSystem: "alpha",
        size: "XL",
        color: "white",
        sku: "RD-M-SHIRT-001-WHT-XL",
        regularPrice: "59.90",
        salePrice: null,
        costPrice: "24.00",
        stock: 14,
      },
      {
        sizeSystem: "alpha",
        size: "M",
        color: "blue",
        sku: "RD-M-SHIRT-001-BLU-M",
        regularPrice: "59.90",
        salePrice: "54.90",
        costPrice: "24.00",
        stock: 18,
      },
      {
        sizeSystem: "alpha",
        size: "L",
        color: "blue",
        sku: "RD-M-SHIRT-001-BLU-L",
        regularPrice: "59.90",
        salePrice: "54.90",
        costPrice: "24.00",
        stock: 17,
      },
    ],
  },

  {
    code: "RD-M-JEANS-001",
    slug: "men-slim-fit-jeans",

    vendorCode: "redress_demo_store",

    brandCode: "urban_loom",

    categoryCode: "men_jeans",

    fitProfileCode: "slim",

    translations: {
      en: {
        name: "Slim Fit Jeans",

        shortDescription: "Modern slim-fit jeans in classic blue denim.",

        description:
          "Everyday denim with a clean slim silhouette and comfortable construction.",

        careInstructions: "Wash inside out in cold water.",

        sizeAndFitNotes: "Slim fit through seat and thigh.",

        seoTitle: "Men's Slim Fit Jeans",

        seoDescription:
          "Shop modern slim fit men's jeans in classic blue denim.",
      },

      it: {
        name: "Jeans Uomo Slim Fit",

        shortDescription: "Jeans moderni slim fit in denim blu classico.",

        description:
          "Denim quotidiano con linea slim e costruzione confortevole.",

        careInstructions: "Lavare al rovescio in acqua fredda.",

        sizeAndFitNotes: "Vestibilità slim su fianchi e cosce.",

        seoTitle: "Jeans Uomo Slim Fit",

        seoDescription: "Scopri i jeans uomo slim fit in denim blu classico.",
      },
    },

    variants: [
      {
        sizeSystem: "waist_in",
        size: "30",
        color: "blue",
        sku: "RD-M-JEANS-001-BLU-30",
        regularPrice: "69.90",
        salePrice: null,
        costPrice: "29.00",
        stock: 16,
      },
      {
        sizeSystem: "waist_in",
        size: "32",
        color: "blue",
        sku: "RD-M-JEANS-001-BLU-32",
        regularPrice: "69.90",
        salePrice: null,
        costPrice: "29.00",
        stock: 24,
        isDefault: true,
      },
      {
        sizeSystem: "waist_in",
        size: "34",
        color: "blue",
        sku: "RD-M-JEANS-001-BLU-34",
        regularPrice: "69.90",
        salePrice: null,
        costPrice: "29.00",
        stock: 22,
      },
      {
        sizeSystem: "waist_in",
        size: "36",
        color: "blue",
        sku: "RD-M-JEANS-001-BLU-36",
        regularPrice: "69.90",
        salePrice: null,
        costPrice: "29.00",
        stock: 16,
      },
      {
        sizeSystem: "waist_in",
        size: "38",
        color: "blue",
        sku: "RD-M-JEANS-001-BLU-38",
        regularPrice: "69.90",
        salePrice: null,
        costPrice: "29.00",
        stock: 10,
      },
    ],
  },

  {
    code: "RD-M-SHOE-001",
    slug: "minimal-casual-sneakers",

    vendorCode: "redress_demo_store",

    brandCode: "north_thread",

    categoryCode: "men_casual_shoes",

    fitProfileCode: null,

    translations: {
      en: {
        name: "Minimal Casual Sneakers",

        shortDescription:
          "Clean everyday sneakers with a minimal modern finish.",

        description:
          "Versatile casual sneakers designed for everyday city wear and weekend styling.",

        careInstructions: "Wipe clean with a damp cloth.",

        sizeAndFitNotes: "Standard EU footwear sizing.",

        seoTitle: "Men's Minimal Casual Sneakers",

        seoDescription: "Shop minimal men's casual sneakers for everyday wear.",
      },

      it: {
        name: "Sneakers Casual Minimal",

        shortDescription: "Sneakers quotidiane dal design pulito e moderno.",

        description:
          "Sneakers casual versatili pensate per la città e il tempo libero.",

        careInstructions: "Pulire con un panno umido.",

        sizeAndFitNotes: "Taglie standard europee.",

        seoTitle: "Sneakers Casual Uomo Minimal",

        seoDescription: "Scopri le sneakers casual uomo dal design minimal.",
      },
    },

    variants: [
      {
        sizeSystem: "eu_footwear",
        size: "40",
        color: "white",
        sku: "RD-M-SHOE-001-WHT-40",
        regularPrice: "89.90",
        salePrice: null,
        costPrice: "38.00",
        stock: 10,
      },
      {
        sizeSystem: "eu_footwear",
        size: "41",
        color: "white",
        sku: "RD-M-SHOE-001-WHT-41",
        regularPrice: "89.90",
        salePrice: null,
        costPrice: "38.00",
        stock: 14,
      },
      {
        sizeSystem: "eu_footwear",
        size: "42",
        color: "white",
        sku: "RD-M-SHOE-001-WHT-42",
        regularPrice: "89.90",
        salePrice: null,
        costPrice: "38.00",
        stock: 20,
        isDefault: true,
      },
      {
        sizeSystem: "eu_footwear",
        size: "43",
        color: "white",
        sku: "RD-M-SHOE-001-WHT-43",
        regularPrice: "89.90",
        salePrice: null,
        costPrice: "38.00",
        stock: 18,
      },
      {
        sizeSystem: "eu_footwear",
        size: "44",
        color: "white",
        sku: "RD-M-SHOE-001-WHT-44",
        regularPrice: "89.90",
        salePrice: null,
        costPrice: "38.00",
        stock: 12,
      },
      {
        sizeSystem: "eu_footwear",
        size: "45",
        color: "white",
        sku: "RD-M-SHOE-001-WHT-45",
        regularPrice: "89.90",
        salePrice: null,
        costPrice: "38.00",
        stock: 7,
      },
    ],
  },

  {
    code: "RD-B-TSHIRT-001",
    slug: "boys-graphic-tshirt",

    vendorCode: "redress_demo_store",

    brandCode: "redress_essentials",

    categoryCode: "boys_tshirts",

    fitProfileCode: "regular",

    translations: {
      en: {
        name: "Boys Graphic T-Shirt",

        shortDescription: "Comfortable cotton graphic T-shirt for kids.",

        description:
          "Soft everyday cotton T-shirt with a playful graphic design.",

        careInstructions: "Machine wash cold.",

        sizeAndFitNotes: "Regular kids fit.",

        seoTitle: "Boys Graphic Cotton T-Shirt",

        seoDescription: "Shop comfortable graphic T-shirts for boys.",
      },

      it: {
        name: "T-Shirt Grafica Bambino",

        shortDescription: "Comoda T-shirt in cotone con stampa grafica.",

        description:
          "T-shirt morbida in cotone per tutti i giorni con grafica giocosa.",

        careInstructions: "Lavare in lavatrice a freddo.",

        sizeAndFitNotes: "Vestibilità regolare bambino.",

        seoTitle: "T-Shirt Grafica Bambino in Cotone",

        seoDescription: "Scopri le comode T-shirt grafiche per bambino.",
      },
    },

    variants: [
      {
        sizeSystem: "kids_age",
        size: "4-5Y",
        color: "green",
        sku: "RD-B-TSHIRT-001-GRN-4-5Y",
        regularPrice: "22.90",
        salePrice: null,
        costPrice: "8.00",
        stock: 14,
      },
      {
        sizeSystem: "kids_age",
        size: "5-6Y",
        color: "green",
        sku: "RD-B-TSHIRT-001-GRN-5-6Y",
        regularPrice: "22.90",
        salePrice: null,
        costPrice: "8.00",
        stock: 18,
      },
      {
        sizeSystem: "kids_age",
        size: "6-7Y",
        color: "green",
        sku: "RD-B-TSHIRT-001-GRN-6-7Y",
        regularPrice: "22.90",
        salePrice: null,
        costPrice: "8.00",
        stock: 20,
        isDefault: true,
      },
      {
        sizeSystem: "kids_age",
        size: "7-8Y",
        color: "green",
        sku: "RD-B-TSHIRT-001-GRN-7-8Y",
        regularPrice: "22.90",
        salePrice: null,
        costPrice: "8.00",
        stock: 16,
      },
    ],
  },

  {
    code: "RD-G-DRESS-001",
    slug: "girls-party-dress",

    vendorCode: "modaviva_official",

    brandCode: "velora",

    categoryCode: "girls_dresses",

    fitProfileCode: "regular",

    translations: {
      en: {
        name: "Girls Party Dress",

        shortDescription: "Pretty occasion dress with a comfortable kids fit.",

        description:
          "A charming party dress designed for celebrations, family events and special occasions.",

        careInstructions: "Gentle wash. Do not bleach.",

        sizeAndFitNotes: "Regular kids fit.",

        seoTitle: "Girls Party Dress",

        seoDescription: "Shop elegant party dresses for girls.",
      },

      it: {
        name: "Abito da Festa Bambina",

        shortDescription:
          "Elegante abito da occasione con vestibilità confortevole.",

        description:
          "Un grazioso abito da festa pensato per celebrazioni ed eventi speciali.",

        careInstructions: "Lavaggio delicato. Non candeggiare.",

        sizeAndFitNotes: "Vestibilità regolare bambina.",

        seoTitle: "Abito da Festa Bambina",

        seoDescription: "Scopri eleganti abiti da festa per bambina.",
      },
    },

    variants: [
      {
        sizeSystem: "kids_age",
        size: "4-5Y",
        color: "pink",
        sku: "RD-G-DRESS-001-PNK-4-5Y",
        regularPrice: "49.90",
        salePrice: "44.90",
        costPrice: "19.00",
        stock: 10,
      },
      {
        sizeSystem: "kids_age",
        size: "5-6Y",
        color: "pink",
        sku: "RD-G-DRESS-001-PNK-5-6Y",
        regularPrice: "49.90",
        salePrice: "44.90",
        costPrice: "19.00",
        stock: 15,
      },
      {
        sizeSystem: "kids_age",
        size: "6-7Y",
        color: "pink",
        sku: "RD-G-DRESS-001-PNK-6-7Y",
        regularPrice: "49.90",
        salePrice: "44.90",
        costPrice: "19.00",
        stock: 16,
        isDefault: true,
      },
      {
        sizeSystem: "kids_age",
        size: "7-8Y",
        color: "pink",
        sku: "RD-G-DRESS-001-PNK-7-8Y",
        regularPrice: "49.90",
        salePrice: "44.90",
        costPrice: "19.00",
        stock: 11,
      },
    ],
  },

  {
    code: "RD-W-SKIRT-001",
    slug: "pleated-midi-skirt",

    vendorCode: "modaviva_official",

    brandCode: "modaviva",

    categoryCode: "women_skirts",

    fitProfileCode: "regular",

    translations: {
      en: {
        name: "Pleated Midi Skirt",

        shortDescription:
          "Flowing pleated midi skirt with an elegant silhouette.",

        description:
          "A versatile midi skirt featuring soft pleats and an easy everyday silhouette.",

        careInstructions: "Gentle wash. Hang to dry.",

        sizeAndFitNotes: "Regular fit with comfortable waist.",

        seoTitle: "Women's Pleated Midi Skirt",

        seoDescription: "Shop elegant pleated midi skirts for women.",
      },

      it: {
        name: "Gonna Midi Plissettata",

        shortDescription: "Gonna midi fluida con eleganti pieghe.",

        description:
          "Gonna midi versatile con morbide pieghe e linea confortevole.",

        careInstructions: "Lavaggio delicato. Appendere ad asciugare.",

        sizeAndFitNotes: "Vestibilità regolare con vita confortevole.",

        seoTitle: "Gonna Midi Plissettata Donna",

        seoDescription: "Scopri eleganti gonne midi plissettate da donna.",
      },
    },

    variants: [
      {
        sizeSystem: "alpha",
        size: "S",
        color: "black",
        sku: "RD-W-SKIRT-001-BLK-S",
        regularPrice: "54.90",
        salePrice: null,
        costPrice: "21.00",
        stock: 12,
      },
      {
        sizeSystem: "alpha",
        size: "M",
        color: "black",
        sku: "RD-W-SKIRT-001-BLK-M",
        regularPrice: "54.90",
        salePrice: null,
        costPrice: "21.00",
        stock: 20,
        isDefault: true,
      },
      {
        sizeSystem: "alpha",
        size: "L",
        color: "black",
        sku: "RD-W-SKIRT-001-BLK-L",
        regularPrice: "54.90",
        salePrice: null,
        costPrice: "21.00",
        stock: 14,
      },
    ],
  },

  {
    code: "RD-M-JACKET-001",
    slug: "lightweight-casual-jacket",

    vendorCode: "redress_demo_store",

    brandCode: "north_thread",

    categoryCode: "men_jackets",

    fitProfileCode: "regular",

    translations: {
      en: {
        name: "Lightweight Casual Jacket",

        shortDescription:
          "Versatile lightweight jacket for transitional weather.",

        description:
          "A clean casual jacket designed for layering during mild and transitional seasons.",

        careInstructions: "Machine wash on gentle cycle.",

        sizeAndFitNotes: "Regular fit suitable for light layering.",

        seoTitle: "Men's Lightweight Casual Jacket",

        seoDescription: "Shop lightweight men's jackets for everyday layering.",
      },

      it: {
        name: "Giacca Casual Leggera",

        shortDescription: "Giacca leggera versatile per la mezza stagione.",

        description:
          "Giacca casual dal design pulito, ideale per vestirsi a strati nelle stagioni miti.",

        careInstructions: "Lavare in lavatrice con ciclo delicato.",

        sizeAndFitNotes:
          "Vestibilità regolare adatta alla stratificazione leggera.",

        seoTitle: "Giacca Casual Leggera Uomo",

        seoDescription:
          "Scopri le giacche leggere da uomo per l'uso quotidiano.",
      },
    },

    variants: [
      {
        sizeSystem: "alpha",
        size: "M",
        color: "navy",
        sku: "RD-M-JACKET-001-NVY-M",
        regularPrice: "99.90",
        salePrice: null,
        costPrice: "42.00",
        stock: 12,
      },
      {
        sizeSystem: "alpha",
        size: "L",
        color: "navy",
        sku: "RD-M-JACKET-001-NVY-L",
        regularPrice: "99.90",
        salePrice: null,
        costPrice: "42.00",
        stock: 18,
        isDefault: true,
      },
      {
        sizeSystem: "alpha",
        size: "XL",
        color: "navy",
        sku: "RD-M-JACKET-001-NVY-XL",
        regularPrice: "99.90",
        salePrice: null,
        costPrice: "42.00",
        stock: 12,
      },
    ],
  },
];

const PRODUCT_CODES = PRODUCTS.map((product) => product.code);

/*
|--------------------------------------------------------------------------
| Demo Product Images
|--------------------------------------------------------------------------
|
| These are the products for which a local asset exists in
| assets/starter-products and is uploaded by `npm run storage:upload:starter`.
|
| Do not create approved media rows for products without an uploaded asset:
| an approved row would generate a signed URL for an object that does not
| exist, causing an avoidable image-load failure in the client.
|
*/

const PRODUCTS_WITH_UPLOADED_IMAGES = new Set([
  "RD-W-DRESS-001",
  "RD-W-JEANS-001",
  "RD-W-HEEL-001",
  "RD-M-TSHIRT-001",
  "RD-M-SHIRT-001",
  "RD-G-DRESS-001",
]);

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

async function getIdByCode({
  queryInterface,
  table,
  code,
  transaction,
  required = true,
}) {
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

  const id = rows[0]?.id ?? null;

  if (!id && required) {
    throw new Error(`Required ${table} record not found for code: ${code}`);
  }

  return id;
}

async function getSizeId({ queryInterface, sizeSystem, size, transaction }) {
  const rows = await queryInterface.sequelize.query(
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
      replacements: {
        sizeSystem,
        size,
      },

      type: QueryTypes.SELECT,
      transaction,
    },
  );

  const id = rows[0]?.id ?? null;

  if (!id) {
    throw new Error(`Size not found: ${sizeSystem}/${size}`);
  }

  return id;
}

async function getSuperAdminId({ queryInterface, transaction }) {
  const rows = await queryInterface.sequelize.query(
    `
        SELECT a.id
        FROM accounts a

        INNER JOIN account_roles ar
          ON ar.account_id = a.id

        INNER JOIN roles r
          ON r.id = ar.role_id

        WHERE r.code = 'super_admin'
          AND a.status = 'active'
          AND r.deleted_at IS NULL

        ORDER BY a.id ASC
        LIMIT 1
      `,
    {
      type: QueryTypes.SELECT,
      transaction,
    },
  );

  return rows[0]?.id ?? null;
}

async function findProductId({ queryInterface, code, transaction }) {
  const rows = await queryInterface.sequelize.query(
    `
        SELECT id
        FROM products
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

async function findVariantId({ queryInterface, sku, transaction }) {
  const rows = await queryInterface.sequelize.query(
    `
        SELECT id
        FROM product_variants
        WHERE sku = :sku
        LIMIT 1
      `,
    {
      replacements: {
        sku,
      },

      type: QueryTypes.SELECT,
      transaction,
    },
  );

  return rows[0]?.id ?? null;
}

/*
|--------------------------------------------------------------------------
| Seed
|--------------------------------------------------------------------------
*/

export async function up({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    const superAdminId = await getSuperAdminId({
      queryInterface,
      transaction,
    });

    for (const product of PRODUCTS) {
      const vendorId = await getIdByCode({
        queryInterface,
        table: "vendors",
        code: product.vendorCode,
        transaction,
      });

      const brandId = await getIdByCode({
        queryInterface,
        table: "brands",
        code: product.brandCode,
        transaction,
      });

      const categoryId = await getIdByCode({
        queryInterface,
        table: "categories",
        code: product.categoryCode,
        transaction,
      });

      const fitProfileId = product.fitProfileCode
        ? await getIdByCode({
            queryInterface,
            table: "fit_profiles",
            code: product.fitProfileCode,
            transaction,
          })
        : null;

      let productId = await findProductId({
        queryInterface,
        code: product.code,
        transaction,
      });

      const now = new Date();

      if (!productId) {
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

              is_featured: false,

              is_returnable: true,

              return_window_days: 14,

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

        productId = await findProductId({
          queryInterface,
          code: product.code,
          transaction,
        });
      }

      /*
      |--------------------------------------------------------------------------
      | Product Translations
      |--------------------------------------------------------------------------
      */

      for (const [languageCode, translation] of Object.entries(
        product.translations,
      )) {
        const existing = await queryInterface.sequelize.query(
          `
              SELECT id
              FROM product_translations
              WHERE product_id = :productId
                AND language_code = :languageCode
              LIMIT 1
            `,
          {
            replacements: {
              productId,
              languageCode,
            },

            type: QueryTypes.SELECT,

            transaction,
          },
        );

        if (existing.length === 0) {
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
      }

      /*
      |--------------------------------------------------------------------------
      | Primary Category
      |--------------------------------------------------------------------------
      */

      const existingCategory = await queryInterface.sequelize.query(
        `
            SELECT id
            FROM product_categories
            WHERE product_id = :productId
              AND category_id = :categoryId
            LIMIT 1
          `,
        {
          replacements: {
            productId,
            categoryId,
          },

          type: QueryTypes.SELECT,

          transaction,
        },
      );

      if (existingCategory.length === 0) {
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
      | Variants + Inventory
      |--------------------------------------------------------------------------
      */

      for (const [variantIndex, variant] of product.variants.entries()) {
        const sizeId = await getSizeId({
          queryInterface,

          sizeSystem: variant.sizeSystem,

          size: variant.size,

          transaction,
        });

        const colorId = await getIdByCode({
          queryInterface,
          table: "colors",
          code: variant.color,
          transaction,
        });

        let variantId = await findVariantId({
          queryInterface,
          sku: variant.sku,
          transaction,
        });

        if (!variantId) {
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

                is_default: variant.isDefault ?? false,

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

          variantId = await findVariantId({
            queryInterface,
            sku: variant.sku,
            transaction,
          });
        }

        const existingInventory = await queryInterface.sequelize.query(
          `
              SELECT id
              FROM inventory
              WHERE variant_id = :variantId
              LIMIT 1
            `,
          {
            replacements: {
              variantId,
            },

            type: QueryTypes.SELECT,

            transaction,
          },
        );

        if (existingInventory.length === 0) {
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
      }

      /*
      |--------------------------------------------------------------------------
      | Product Media References
      |--------------------------------------------------------------------------
      |
      | These are storage keys, not external URLs. Only records with a
      | corresponding uploaded S3 object are created.
      |
      */

      const englishName = product.translations.en.name;

      const mediaItems = PRODUCTS_WITH_UPLOADED_IMAGES.has(product.code)
        ? [
            {
              storageKey: buildProductImageKey(product.code, "main"),

              altText: englishName,

              sortOrder: 10,

              isPrimary: true,
            },

            {
              storageKey: buildProductImageKey(product.code, "gallery-01"),

              altText: `${englishName} alternate view`,

              sortOrder: 20,

              isPrimary: false,
            },
          ]
        : [];

      for (const media of mediaItems) {
        const existingMedia = await queryInterface.sequelize.query(
          `
              SELECT id
              FROM product_media
              WHERE product_id = :productId
                AND storage_key = :storageKey
              LIMIT 1
            `,
          {
            replacements: {
              productId,

              storageKey: media.storageKey,
            },

            type: QueryTypes.SELECT,

            transaction,
          },
        );

        if (existingMedia.length === 0) {
          await queryInterface.bulkInsert(
            "product_media",
            [
              {
                product_id: productId,

                variant_id: null,

                media_type: "image",

                storage_key: media.storageKey,

                mime_type: "image/webp",

                alt_text: media.altText,

                width: 1200,

                height: 1600,

                duration_seconds: null,

                sort_order: media.sortOrder,

                is_primary: media.isPrimary,

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
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

/*
|--------------------------------------------------------------------------
| Rollback
|--------------------------------------------------------------------------
|
| Deleting products cascades to:
|
| translations
| category mappings
| variants
| media
| inventory through variants
|
*/

export async function down({ context: queryInterface }) {
  await queryInterface.bulkDelete("products", {
    code: {
      [Op.in]: PRODUCT_CODES,
    },
  });
}
