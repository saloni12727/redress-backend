import { DataTypes, Model } from "sequelize";

import { sequelize } from "../config/database.js";

export class ProductTranslation extends Model {}

ProductTranslation.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    productId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: "product_id",
    },

    languageCode: {
      type: DataTypes.STRING(10),
      allowNull: false,
      field: "language_code",
    },

    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },

    shortDescription: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "short_description",
    },

    description: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
    },

    careInstructions: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "care_instructions",
    },

    sizeAndFitNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "size_and_fit_notes",
    },

    seoTitle: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "seo_title",
    },

    seoDescription: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: "seo_description",
    },
  },
  {
    sequelize,
    modelName: "ProductTranslation",
    tableName: "product_translations",

    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",

    underscored: true,
  },
);

export default ProductTranslation;
