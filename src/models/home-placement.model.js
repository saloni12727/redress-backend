import { DataTypes, Model } from "sequelize";

import { sequelize } from "../config/database.js";

export class HomePlacement extends Model {}

HomePlacement.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    sectionKey: {
      type: DataTypes.STRING(40),
      allowNull: false,
      field: "section_key",
    },
    targetType: {
      type: DataTypes.STRING(32),
      allowNull: false,
      field: "target_type",
    },
    targetProductId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: "target_product_id",
    },
    targetBrandId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: "target_brand_id",
    },
    targetCategoryId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: "target_category_id",
    },
    targetFilters: {
      type: DataTypes.JSON,
      allowNull: true,
      field: "target_filters",
    },
    linkPath: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: "link_path",
    },
    linkQuery: {
      type: DataTypes.JSON,
      allowNull: true,
      field: "link_query",
    },
    externalUrl: {
      type: DataTypes.STRING(2048),
      allowNull: true,
      field: "external_url",
      validate: {
        isUrl: true,
      },
    },
    offerPayload: {
      type: DataTypes.JSON,
      allowNull: true,
      field: "offer_payload",
    },
    imageStorageKey: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: "image_storage_key",
    },
    imageWidth: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: "image_width",
    },
    imageHeight: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: "image_height",
    },
    imageContentType: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "image_content_type",
    },
    imageSizeBytes: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field: "image_size_bytes",
    },
    titleEn: {
      type: DataTypes.STRING(200),
      allowNull: true,
      field: "title_en",
    },
    titleIt: {
      type: DataTypes.STRING(200),
      allowNull: true,
      field: "title_it",
    },
    subtitleEn: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: "subtitle_en",
    },
    subtitleIt: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: "subtitle_it",
    },
    ctaLabelEn: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "cta_label_en",
    },
    ctaLabelIt: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "cta_label_it",
    },
    altTextEn: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "alt_text_en",
    },
    altTextIt: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "alt_text_it",
    },
    badgeEn: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "badge_en",
    },
    badgeIt: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "badge_it",
    },
    discountLabelEn: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "discount_label_en",
    },
    discountLabelIt: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "discount_label_it",
    },
    source: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "admin",
      validate: {
        isIn: [["admin", "seller"]],
      },
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "draft",
    },
    startsAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "starts_at",
    },
    endsAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "ends_at",
    },
    sortOrder: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: "sort_order",
    },
    createdByAccountId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: "created_by_account_id",
    },
    updatedByAccountId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: "updated_by_account_id",
    },
    publishedByAccountId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: "published_by_account_id",
    },
    publishedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "published_at",
    },
  },
  {
    sequelize,
    modelName: "HomePlacement",
    tableName: "home_placements",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    paranoid: true,
    deletedAt: "deleted_at",
    underscored: true,
  },
);

export default HomePlacement;
