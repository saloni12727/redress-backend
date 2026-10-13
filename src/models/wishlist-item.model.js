import { DataTypes, Model } from "sequelize";

import { sequelize } from "../config/database.js";

export class WishlistItem extends Model {}

WishlistItem.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },

    accountId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: "account_id",
    },

    productId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: "product_id",
    },
  },
  {
    sequelize,
    modelName: "WishlistItem",
    tableName: "wishlist_items",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    underscored: true,
    indexes: [
      {
        name: "uq_wishlist_items_account_product",
        unique: true,
        fields: ["account_id", "product_id"],
      },
      {
        name: "idx_wishlist_items_account_created",
        fields: ["account_id", "created_at"],
      },
    ],
  },
);

export default WishlistItem;
