import { DataTypes } from "sequelize";

/*
|--------------------------------------------------------------------------
| Create Home Placements Table
|--------------------------------------------------------------------------
|
| Home is assembled from explicit, scheduled placements rather than from
| client-side paths or hard-coded marketing data. The actual target remains
| typed (product, brand, category, or catalog) so a mobile client never has
| to trust an arbitrary URL supplied by content.
|
*/

export async function up({ context: queryInterface }) {
  await queryInterface.createTable("home_placements", {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    section_key: {
      type: DataTypes.STRING(40),
      allowNull: false,
    },

    target_type: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },

    target_product_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      references: { model: "products", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },

    target_brand_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      references: { model: "brands", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },

    target_category_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      references: { model: "categories", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },

    target_filters: {
      type: DataTypes.JSON,
      allowNull: true,
    },

    image_storage_key: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },

    image_width: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },

    image_height: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },

    title_en: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },

    title_it: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },

    subtitle_en: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },

    subtitle_it: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },

    cta_label_en: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    cta_label_it: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    alt_text_en: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    alt_text_it: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "draft",
    },

    starts_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    ends_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    sort_order: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },

    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },

    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },

    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  });

  await queryInterface.addIndex(
    "home_placements",
    ["section_key", "status", "starts_at", "ends_at", "sort_order"],
    { name: "idx_home_placements_feed" },
  );

  await queryInterface.addIndex("home_placements", ["target_product_id"], {
    name: "idx_home_placements_product",
  });

  await queryInterface.addIndex("home_placements", ["target_brand_id"], {
    name: "idx_home_placements_brand",
  });

  await queryInterface.addIndex("home_placements", ["target_category_id"], {
    name: "idx_home_placements_category",
  });
}

export async function down({ context: queryInterface }) {
  await queryInterface.dropTable("home_placements");
}
