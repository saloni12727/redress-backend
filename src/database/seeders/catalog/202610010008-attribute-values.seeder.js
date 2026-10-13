import { Op, QueryTypes } from "sequelize";

const VALUES = {
  fabric: [
    ["cotton", "Cotton", "Cotone"],
    ["linen", "Linen", "Lino"],
    ["polyester", "Polyester", "Poliestere"],
    ["viscose", "Viscose", "Viscosa"],
    ["rayon", "Rayon", "Rayon"],
    ["wool", "Wool", "Lana"],
    ["denim", "Denim", "Denim"],
    ["silk", "Silk", "Seta"],
    ["satin", "Satin", "Raso"],
    ["chiffon", "Chiffon", "Chiffon"],
    ["georgette", "Georgette", "Georgette"],
    ["knit", "Knit", "Maglia"],
    ["nylon", "Nylon", "Nylon"],
    ["leather", "Leather", "Pelle"],
    ["faux_leather", "Faux Leather", "Ecopelle"],
  ],

  pattern: [
    ["solid", "Solid", "Tinta Unita"],
    ["printed", "Printed", "Stampato"],
    ["floral", "Floral", "Floreale"],
    ["striped", "Striped", "A Righe"],
    ["checked", "Checked", "A Quadri"],
    ["graphic", "Graphic", "Grafico"],
    ["textured", "Textured", "Testurizzato"],
    ["embroidered", "Embroidered", "Ricamato"],
    ["polka_dot", "Polka Dot", "Pois"],
  ],

  sleeve_length: [
    ["sleeveless", "Sleeveless", "Senza Maniche"],
    ["cap_sleeve", "Cap Sleeve", "Manica Corta Coprispalla"],
    ["short_sleeve", "Short Sleeve", "Manica Corta"],
    ["half_sleeve", "Half Sleeve", "Mezza Manica"],
    ["three_quarter", "3/4 Sleeve", "Manica 3/4"],
    ["long_sleeve", "Long Sleeve", "Manica Lunga"],
  ],

  neck_type: [
    ["round_neck", "Round Neck", "Girocollo"],
    ["crew_neck", "Crew Neck", "Collo Tondo"],
    ["v_neck", "V-Neck", "Scollo a V"],
    ["square_neck", "Square Neck", "Scollo Quadrato"],
    ["boat_neck", "Boat Neck", "Scollo a Barca"],
    ["halter_neck", "Halter Neck", "Collo Allacciato"],
    ["sweetheart", "Sweetheart", "Scollo a Cuore"],
    ["high_neck", "High Neck", "Collo Alto"],
    ["scoop_neck", "Scoop Neck", "Scollo Ampio"],
  ],

  collar_type: [
    ["spread", "Spread Collar", "Colletto Aperto"],
    ["button_down", "Button-Down", "Button Down"],
    ["mandarin", "Mandarin Collar", "Collo Coreano"],
    ["polo", "Polo Collar", "Colletto Polo"],
    ["band", "Band Collar", "Colletto a Fascia"],
    ["cutaway", "Cutaway Collar", "Colletto Cutaway"],
    ["no_collar", "No Collar", "Senza Colletto"],
  ],

  occasion: [
    ["casual", "Casual", "Casual"],
    ["formal", "Formal", "Formale"],
    ["work", "Work", "Lavoro"],
    ["party", "Party", "Festa"],
    ["festive", "Festive", "Festivo"],
    ["wedding", "Wedding", "Matrimonio"],
    ["sports", "Sports", "Sport"],
    ["travel", "Travel", "Viaggio"],
  ],

  closure: [
    ["button", "Button", "Bottoni"],
    ["zipper", "Zipper", "Cerniera"],
    ["pull_on", "Pull On", "Senza Chiusura"],
    ["lace_up", "Lace-Up", "Lacci"],
    ["buckle", "Buckle", "Fibbia"],
    ["hook_eye", "Hook & Eye", "Gancio"],
    ["elastic", "Elastic", "Elastico"],
    ["slip_on", "Slip-On", "Slip-On"],
    ["velcro", "Velcro", "Velcro"],
    ["drawstring", "Drawstring", "Coulisse"],
  ],

  waist_rise: [
    ["low", "Low Rise", "Vita Bassa"],
    ["mid", "Mid Rise", "Vita Media"],
    ["high", "High Rise", "Vita Alta"],
  ],

  stretchability: [
    ["non_stretch", "Non Stretch", "Non Elasticizzato"],
    ["slight_stretch", "Slight Stretch", "Leggermente Elasticizzato"],
    ["medium_stretch", "Medium Stretch", "Elasticità Media"],
    ["high_stretch", "High Stretch", "Molto Elasticizzato"],
  ],

  transparency: [
    ["opaque", "Opaque", "Opaco"],
    ["semi_sheer", "Semi Sheer", "Semi Trasparente"],
    ["sheer", "Sheer", "Trasparente"],
  ],

  dress_shape: [
    ["a_line", "A-Line", "Linea A"],
    ["bodycon", "Bodycon", "Aderente"],
    ["fit_flare", "Fit & Flare", "Fit & Flare"],
    ["shift", "Shift", "Dritto"],
    ["wrap", "Wrap", "Portafoglio"],
    ["sheath", "Sheath", "Tubino"],
  ],

  dress_length: [
    ["mini", "Mini", "Mini"],
    ["knee", "Knee Length", "Al Ginocchio"],
    ["midi", "Midi", "Midi"],
    ["maxi", "Maxi", "Maxi"],
  ],

  upper_material: [
    ["leather", "Leather", "Pelle"],
    ["faux_leather", "Faux Leather", "Ecopelle"],
    ["textile", "Textile", "Tessuto"],
    ["mesh", "Mesh", "Rete"],
    ["synthetic", "Synthetic", "Sintetico"],
    ["suede", "Suede", "Camoscio"],
  ],

  sole_material: [
    ["rubber", "Rubber", "Gomma"],
    ["eva", "EVA", "EVA"],
    ["tpr", "TPR", "TPR"],
    ["leather", "Leather", "Pelle"],
    ["pu", "PU", "PU"],
  ],

  heel_type: [
    ["block", "Block Heel", "Tacco Largo"],
    ["stiletto", "Stiletto", "Stiletto"],
    ["kitten", "Kitten Heel", "Tacco Kitten"],
    ["wedge", "Wedge", "Zeppa"],
    ["platform", "Platform", "Plateau"],
    ["flat", "Flat", "Senza Tacco"],
  ],

  toe_shape: [
    ["round", "Round Toe", "Punta Tonda"],
    ["pointed", "Pointed Toe", "Punta Affusolata"],
    ["square", "Square Toe", "Punta Quadrata"],
    ["open", "Open Toe", "Punta Aperta"],
  ],

  shoe_width: [
    ["narrow", "Narrow", "Stretta"],
    ["standard", "Standard", "Standard"],
    ["wide", "Wide", "Larga"],
  ],

  bag_type: [
    ["tote", "Tote", "Tote"],
    ["shoulder", "Shoulder Bag", "Borsa a Spalla"],
    ["crossbody", "Crossbody", "Tracolla"],
    ["backpack", "Backpack", "Zaino"],
    ["clutch", "Clutch", "Pochette"],
    ["handbag", "Handbag", "Borsa a Mano"],
  ],

  jewellery_type: [
    ["earrings", "Earrings", "Orecchini"],
    ["necklace", "Necklace", "Collana"],
    ["bracelet", "Bracelet", "Bracciale"],
    ["ring", "Ring", "Anello"],
  ],
};

async function getAttributeId(queryInterface, code, transaction) {
  const rows = await queryInterface.sequelize.query(
    `
        SELECT id
        FROM attributes
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
    throw new Error(`Attribute not found: ${code}`);
  }

  return rows[0].id;
}

export async function up({ context: queryInterface }) {
  const transaction = await queryInterface.sequelize.transaction();

  try {
    for (const [attributeCode, values] of Object.entries(VALUES)) {
      const attributeId = await getAttributeId(
        queryInterface,
        attributeCode,
        transaction,
      );

      const existingRows = await queryInterface.sequelize.query(
        `
            SELECT code
            FROM attribute_values
            WHERE attribute_id = :attributeId
          `,
        {
          replacements: {
            attributeId,
          },

          type: QueryTypes.SELECT,

          transaction,
        },
      );

      const existingCodes = new Set(existingRows.map((row) => row.code));

      const now = new Date();

      const rows = values
        .filter(([code]) => !existingCodes.has(code))
        .map(([code, labelEn, labelIt], index) => ({
          attribute_id: attributeId,

          code,

          label_en: labelEn,

          label_it: labelIt,

          sort_order: (index + 1) * 10,

          is_active: true,

          created_at: now,

          updated_at: now,
        }));

      if (rows.length > 0) {
        await queryInterface.bulkInsert("attribute_values", rows, {
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
    for (const [attributeCode, values] of Object.entries(VALUES)) {
      const attributeRows = await queryInterface.sequelize.query(
        `
            SELECT id
            FROM attributes
            WHERE code = :code
            LIMIT 1
          `,
        {
          replacements: {
            code: attributeCode,
          },

          type: QueryTypes.SELECT,

          transaction,
        },
      );

      if (!attributeRows[0]?.id) {
        continue;
      }

      await queryInterface.bulkDelete(
        "attribute_values",
        {
          attribute_id: attributeRows[0].id,

          code: {
            [Op.in]: values.map(([code]) => code),
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
