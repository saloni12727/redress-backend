import { DataTypes, Model } from "sequelize";

import { sequelize } from "../config/database.js";

/*
|--------------------------------------------------------------------------
| Content Policy
|--------------------------------------------------------------------------
|
| updatedAt is used as the current consent version.
|
| Because `underscored: true`, Sequelize maps:
|
| createdAt -> created_at
| updatedAt -> updated_at
|
*/

export class ContentPolicy extends Model {}

ContentPolicy.init(
  {
    id: {
      type: DataTypes.STRING(64),
      allowNull: false,
      primaryKey: true,
    },

    title: {
      type: DataTypes.STRING(191),
      allowNull: false,
    },

    sections: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },

    isPublished: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: "is_published",
    },
  },
  {
    sequelize,

    modelName: "ContentPolicy",

    tableName: "content_policies",

    timestamps: true,

    underscored: true,
  },
);

export default ContentPolicy;
