import { DataTypes, Model } from "sequelize";

import { sequelize } from "../config/database.js";

export class CategoryTranslation extends Model {}

CategoryTranslation.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    categoryId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: "category_id",
    },

    languageCode: {
      type: DataTypes.STRING(10),
      allowNull: false,
      field: "language_code",
    },

    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,

    modelName: "CategoryTranslation",

    tableName: "category_translations",

    timestamps: true,

    createdAt: "created_at",

    updatedAt: "updated_at",

    underscored: true,
  },
);

export default CategoryTranslation;
