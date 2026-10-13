import { DataTypes, Model } from "sequelize";

import { sequelize } from "../config/database.js";

export class Category extends Model {}

Category.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    parentId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: "parent_id",
    },

    code: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },

    slug: {
      type: DataTypes.STRING(150),
      allowNull: false,
      unique: true,
    },

    sortOrder: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: "sort_order",
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
    modelName: "Category",
    tableName: "categories",

    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",

    paranoid: true,
    deletedAt: "deleted_at",

    underscored: true,
  },
);

export default Category;
