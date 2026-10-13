import { DataTypes, Model } from "sequelize";

import { sequelize } from "../config/database.js";

export class Attribute extends Model {}

Attribute.init(
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

    nameEn: {
      type: DataTypes.STRING(150),
      allowNull: false,
      field: "name_en",
    },

    nameIt: {
      type: DataTypes.STRING(150),
      allowNull: false,
      field: "name_it",
    },

    dataType: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "option",
      field: "data_type",

      validate: {
        isIn: [["option", "text", "decimal", "boolean"]],
      },
    },

    inputType: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "select",
      field: "input_type",

      validate: {
        isIn: [["select", "multiselect", "text", "number", "toggle"]],
      },
    },

    unitCode: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: "unit_code",
    },

    allowsMultiple: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "allows_multiple",
    },

    isFilterable: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: "is_filterable",
    },

    isSearchable: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "is_searchable",
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
    modelName: "Attribute",
    tableName: "attributes",

    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",

    underscored: true,
  },
);

export default Attribute;
