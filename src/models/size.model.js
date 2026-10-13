import { DataTypes, Model } from "sequelize";

import { sequelize } from "../config/database.js";

export class Size extends Model {}

Size.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    sizeSystemId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: "size_system_id",
    },

    code: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },

    label: {
      type: DataTypes.STRING(50),
      allowNull: false,
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
    modelName: "Size",
    tableName: "sizes",

    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",

    underscored: true,

    indexes: [
      {
        name: "uq_sizes_system_code",

        unique: true,

        fields: ["size_system_id", "code"],
      },
    ],
  },
);

export default Size;
