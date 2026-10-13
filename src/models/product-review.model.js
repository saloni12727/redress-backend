import { DataTypes, Model } from "sequelize";

import { sequelize } from "../config/database.js";

export class ProductReview extends Model {}

ProductReview.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, autoIncrement: true, primaryKey: true },
    productId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: "product_id" },
    accountId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: "account_id" },
    orderItemId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true, unique: true, field: "order_item_id" },
    rating: { type: DataTypes.TINYINT.UNSIGNED, allowNull: false, validate: { min: 1, max: 5 } },
    title: { type: DataTypes.STRING(180), allowNull: true },
    body: { type: DataTypes.TEXT, allowNull: true },
    recommends: { type: DataTypes.BOOLEAN, allowNull: true },
    fitFeedback: { type: DataTypes.STRING(10), allowNull: true, field: "fit_feedback", validate: { isIn: [["small", "true", "large"]] } },
    reviewerHeightCm: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: true, field: "reviewer_height_cm" },
    purchasedSizeLabel: { type: DataTypes.STRING(64), allowNull: true, field: "purchased_size_label" },
    purchasedColorName: { type: DataTypes.STRING(100), allowNull: true, field: "purchased_color_name" },
    helpfulCount: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: "helpful_count" },
    sellerReplyBody: { type: DataTypes.TEXT, allowNull: true, field: "seller_reply_body" },
    sellerReplyAt: { type: DataTypes.DATE, allowNull: true, field: "seller_reply_at" },
    isPublished: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: "is_published" },
  },
  {
    sequelize,
    modelName: "ProductReview",
    tableName: "product_reviews",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    underscored: true,
    indexes: [
      { name: "idx_product_reviews_public", fields: ["product_id", "is_published", "created_at"] },
      { name: "idx_product_reviews_rating", fields: ["product_id", "rating"] },
      { name: "idx_product_reviews_account", fields: ["account_id", "product_id"] },
    ],
  },
);

export default ProductReview;
