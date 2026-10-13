import { DataTypes, Model } from "sequelize";

import { sequelize } from "../config/database.js";

export class ProductReviewPhoto extends Model {}

ProductReviewPhoto.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, autoIncrement: true, primaryKey: true },
    reviewId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: "review_id" },
    storageKey: { type: DataTypes.STRING(500), allowNull: false, field: "storage_key" },
    thumbStorageKey: { type: DataTypes.STRING(500), allowNull: true, field: "thumb_storage_key" },
    sortOrder: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: "sort_order" },
  },
  {
    sequelize,
    modelName: "ProductReviewPhoto",
    tableName: "product_review_photos",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    underscored: true,
    indexes: [{ name: "idx_product_review_photos_review", fields: ["review_id", "sort_order"] }],
  },
);

export default ProductReviewPhoto;
