import { DataTypes, Model } from "sequelize";

import { sequelize } from "../config/database.js";

export class AttributeValue extends Model {}

AttributeValue.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    attributeId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: "attribute_id",
    },

    code: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    labelEn: {
      type: DataTypes.STRING(150),
      allowNull: false,
      field: "label_en",
    },

    labelIt: {
      type: DataTypes.STRING(150),
      allowNull: false,
      field: "label_it",
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
    modelName: "AttributeValue",
    tableName: "attribute_values",

    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",

    underscored: true,

    indexes: [
      {
        name: "uq_attribute_values_attribute_code",

        unique: true,

        fields: ["attribute_id", "code"],
      },
    ],
  },
);

export default AttributeValue;
