import { getMediaUrl } from "../../services/media/media-storage.service.js";

import {
  findReviews,
  findReviewSummary,
  findTopReviews,
} from "./catalog.reviews.repository.js";

function id(value) {
  return value === null || value === undefined ? null : String(value);
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function percentage(value, total) {
  if (total <= 0) {
    return 0;
  }

  return Math.round((number(value) / total) * 100);
}

function fitPercentages(summary, total) {
  if (total <= 0) {
    return { small: 0, true: 0, large: 0 };
  }

  const entries = [
    ["small", number(summary?.fitSmall)],
    ["true", number(summary?.fitTrue)],
    ["large", number(summary?.fitLarge)],
  ].map(([key, count], index) => {
    const scaled = (count / total) * 100;

    return {
      key,
      index,
      value: Math.floor(scaled),
      remainder: scaled - Math.floor(scaled),
    };
  });

  let remaining = 100 - entries.reduce((sum, entry) => sum + entry.value, 0);

  for (const entry of [...entries].sort(
    (left, right) => right.remainder - left.remainder || left.index - right.index,
  )) {
    if (remaining <= 0) {
      break;
    }

    entry.value += 1;
    remaining -= 1;
  }

  return Object.fromEntries(entries.map(({ key, value }) => [key, value]));
}

function privateDisplayName(value) {
  const words = String(value ?? "Customer")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "Customer";
  }

  if (words.length === 1) {
    return words[0];
  }

  return `${words[0]} ${words.at(-1)[0]}.`;
}

async function mapPhotos(rows) {
  return Promise.all(
    rows.map(async (row) => ({
      url: row.storageKey ? getMediaUrl(row.storageKey) : null,
      thumbUrl: row.thumbStorageKey
        ? getMediaUrl(row.thumbStorageKey)
        : row.storageKey
          ? getMediaUrl(row.storageKey)
          : null,
    })),
  );
}

async function mapReview(row, photosByReview) {
  return {
    id: id(row.id),
    rating: number(row.rating),
    title: row.title ?? null,
    body: row.body ?? null,
    author: {
      displayName: privateDisplayName(row.authorDisplayName),
      avatarUrl: null,
    },
    createdAt: row.createdAt,
    verifiedPurchase: Boolean(number(row.verifiedPurchase)),
    purchased: {
      sizeLabel: row.purchasedSizeLabel ?? null,
      colorName: row.purchasedColorName ?? null,
    },
    fitFeedback: row.fitFeedback ?? null,
    reviewerHeightCm: row.reviewerHeightCm ?? null,
    photos: await mapPhotos(photosByReview.get(id(row.id)) ?? []),
    helpfulCount: number(row.helpfulCount),
    sellerReply:
      row.sellerReplyBody === null || row.sellerReplyBody === undefined
        ? null
        : {
            body: row.sellerReplyBody,
            createdAt: row.sellerReplyAt,
          },
  };
}

function photosByReview(rows) {
  const result = new Map();

  for (const photo of rows) {
    const key = id(photo.reviewId);
    result.set(key, [...(result.get(key) ?? []), photo]);
  }

  return result;
}

export async function getReviewBlock(productId) {
  const [{ summary, photos }, top] = await Promise.all([
    findReviewSummary(productId),
    findTopReviews(productId),
  ]);

  const count = number(summary?.count);
  const fitCount = number(summary?.fitCount);

  return {
    summary: {
      average: count > 0 ? Number(Number(summary.average).toFixed(1)) : null,
      count,
      distribution: {
        5: number(summary?.rating5),
        4: number(summary?.rating4),
        3: number(summary?.rating3),
        2: number(summary?.rating2),
        1: number(summary?.rating1),
      },
      recommendPercent: percentage(summary?.recommends, number(summary?.recommendCount)),
      withPhotosCount: number(summary?.withPhotosCount),
      fit: fitPercentages(summary, fitCount),
      aspects: [],
      photos: (await mapPhotos(photos)).map((photo, index) => ({
        ...photo,
        reviewId: id(photos[index].reviewId),
      })),
    },
    top: await Promise.all(
      top.rows.map((row) => mapReview(row, photosByReview(top.photos))),
    ),
  };
}

export async function getReviews(productId, filters) {
  const result = await findReviews(productId, filters);
  const groupedPhotos = photosByReview(result.photos);

  return {
    items: await Promise.all(
      result.rows.map((row) => mapReview(row, groupedPhotos)),
    ),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total: result.total,
      totalPages: result.total === 0 ? 0 : Math.ceil(result.total / filters.limit),
    },
  };
}
