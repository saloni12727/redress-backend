import { DataTypes, Model } from "sequelize";

import { sequelize } from "../config/database.js";

export class Brand extends Model {}

Brand.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    code: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },

    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },

    slug: {
      type: DataTypes.STRING(150),
      allowNull: false,
      unique: true,
    },

    logoKey: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: "logo_key",
    },

    websiteUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: "website_url",
    },

    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: "is_active",
    },
  },
  {
    sequelize,
    modelName: "Brand",
    tableName: "brands",

    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",

    paranoid: true,
    deletedAt: "deleted_at",

    underscored: true,
  },
);

export default Brand;
