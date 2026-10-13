import { QueryTypes } from "sequelize";

import { sequelize } from "../../config/database.js";

const PUBLIC_REVIEW_WHERE = `
  review.product_id = :productId
  AND review.is_published = 1
`;

function reviewWhere(filters, replacements) {
  const conditions = [PUBLIC_REVIEW_WHERE];

  if (filters.rating.length > 0) {
    replacements.ratings = filters.rating;
    conditions.push("review.rating IN (:ratings)");
  }

  if (filters.withPhotos === true) {
    conditions.push(`EXISTS (
      SELECT 1 FROM product_review_photos selected_photo
      WHERE selected_photo.review_id = review.id
    )`);
  }

  if (filters.size) {
    replacements.size = filters.size;
    conditions.push("review.purchased_size_label = :size");
  }

  return conditions.join(" AND ");
}

function reviewOrder(sort) {
  return {
    helpful: "review.helpful_count DESC, review.created_at DESC, review.id DESC",
    rating_desc: "review.rating DESC, review.created_at DESC, review.id DESC",
    rating_asc: "review.rating ASC, review.created_at DESC, review.id DESC",
    recent: "review.created_at DESC, review.id DESC",
  }[sort] ?? "review.created_at DESC, review.id DESC";
}

const REVIEW_COLUMNS = `
  review.id,
  review.order_item_id AS orderItemId,
  review.rating,
  review.title,
  review.body,
  review.fit_feedback AS fitFeedback,
  review.reviewer_height_cm AS reviewerHeightCm,
  review.purchased_size_label AS purchasedSizeLabel,
  review.purchased_color_name AS purchasedColorName,
  review.helpful_count AS helpfulCount,
  review.seller_reply_body AS sellerReplyBody,
  review.seller_reply_at AS sellerReplyAt,
  review.created_at AS createdAt,
  account.display_name AS authorDisplayName,
  CASE
    WHEN review_order_item.product_id = review.product_id
      AND review_order.account_id = review.account_id
    THEN 1
    ELSE 0
  END AS verifiedPurchase
`;

const REVIEW_VERIFICATION_JOINS = `
  LEFT JOIN order_items review_order_item
    ON review_order_item.id = review.order_item_id
  LEFT JOIN orders review_order
    ON review_order.id = review_order_item.order_id
`;

async function findPhotos(reviewIds) {
  if (reviewIds.length === 0) {
    return [];
  }

  return sequelize.query(
    `
      SELECT
        photo.id,
        photo.review_id AS reviewId,
        photo.storage_key AS storageKey,
        photo.thumb_storage_key AS thumbStorageKey
      FROM product_review_photos photo
      WHERE photo.review_id IN (:reviewIds)
      ORDER BY photo.review_id ASC, photo.sort_order ASC, photo.id ASC
    `,
    { replacements: { reviewIds }, type: QueryTypes.SELECT },
  );
}

export async function findReviewSummary(productId) {
  const [summary, photos] = await Promise.all([
    sequelize.query(
      `
        SELECT
          COUNT(*) AS count,
          AVG(review.rating) AS average,
          SUM(review.rating = 5) AS rating5,
          SUM(review.rating = 4) AS rating4,
          SUM(review.rating = 3) AS rating3,
          SUM(review.rating = 2) AS rating2,
          SUM(review.rating = 1) AS rating1,
          SUM(review.recommends = 1) AS recommends,
          SUM(review.recommends IS NOT NULL) AS recommendCount,
          SUM(review.fit_feedback = 'small') AS fitSmall,
          SUM(review.fit_feedback = 'true') AS fitTrue,
          SUM(review.fit_feedback = 'large') AS fitLarge,
          SUM(review.fit_feedback IS NOT NULL) AS fitCount,
          SUM(EXISTS (
            SELECT 1 FROM product_review_photos photo
            WHERE photo.review_id = review.id
          )) AS withPhotosCount
        FROM product_reviews review
        WHERE ${PUBLIC_REVIEW_WHERE}
      `,
      { replacements: { productId }, type: QueryTypes.SELECT },
    ).then(([row]) => row ?? null),
    sequelize.query(
      `
        SELECT
          photo.review_id AS reviewId,
          photo.storage_key AS storageKey,
          photo.thumb_storage_key AS thumbStorageKey
        FROM product_review_photos photo
        INNER JOIN product_reviews review
          ON review.id = photo.review_id
          AND ${PUBLIC_REVIEW_WHERE}
        ORDER BY review.created_at DESC, photo.sort_order ASC, photo.id ASC
        LIMIT 10
      `,
      { replacements: { productId }, type: QueryTypes.SELECT },
    ),
  ]);

  return { summary, photos };
}

export async function findTopReviews(productId) {
  const rows = await sequelize.query(
    `
      SELECT ${REVIEW_COLUMNS}
      FROM product_reviews review
      INNER JOIN accounts account ON account.id = review.account_id
      ${REVIEW_VERIFICATION_JOINS}
      WHERE ${PUBLIC_REVIEW_WHERE}
      ORDER BY review.helpful_count DESC, review.created_at DESC, review.id DESC
      LIMIT 3
    `,
    { replacements: { productId }, type: QueryTypes.SELECT },
  );

  return { rows, photos: await findPhotos(rows.map((row) => row.id)) };
}

export async function findReviews(productId, filters) {
  const replacements = { productId };
  const where = reviewWhere(filters, replacements);
  const offset = (filters.page - 1) * filters.limit;

  const [[countRow], rows] = await Promise.all([
    sequelize.query(
      `SELECT COUNT(*) AS total FROM product_reviews review WHERE ${where}`,
      { replacements, type: QueryTypes.SELECT },
    ),
    sequelize.query(
      `
        SELECT ${REVIEW_COLUMNS}
        FROM product_reviews review
        INNER JOIN accounts account ON account.id = review.account_id
        ${REVIEW_VERIFICATION_JOINS}
        WHERE ${where}
        ORDER BY ${reviewOrder(filters.sort)}
        LIMIT :limit OFFSET :offset
      `,
      {
        replacements: { ...replacements, limit: filters.limit, offset },
        type: QueryTypes.SELECT,
      },
    ),
  ]);

  return {
    rows,
    photos: await findPhotos(rows.map((row) => row.id)),
    total: Number(countRow?.total ?? 0),
  };
}
