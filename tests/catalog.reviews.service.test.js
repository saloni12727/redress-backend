import { describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({
  findReviewSummary: vi.fn(),
  findTopReviews: vi.fn(),
  findReviews: vi.fn(),
}));

vi.mock("../src/modules/catalog/catalog.reviews.repository.js", () => repository);
vi.mock("../src/services/media/media-storage.service.js", () => ({
  getMediaUrl: (key) => `https://media.example/${key}`,
}));

import { getReviewBlock, getReviews } from "../src/modules/catalog/catalog.reviews.service.js";

describe("catalog review service", () => {
  it("returns consistent review analytics and private reviewer names", async () => {
    repository.findReviewSummary.mockResolvedValue({
      summary: {
        count: "4", average: "4.25", rating5: "2", rating4: "1", rating3: "1",
        rating2: "0", rating1: "0", recommends: "3", recommendCount: "3",
        fitSmall: "1", fitTrue: "1", fitLarge: "4", fitCount: "6", withPhotosCount: "1",
      },
      photos: [{ reviewId: 7, storageKey: "reviews/7.webp", thumbStorageKey: null }],
    });
    repository.findTopReviews.mockResolvedValue({
      rows: [{ id: 7, orderItemId: 9, verifiedPurchase: 1, rating: 5, authorDisplayName: "Giulia Rossi", helpfulCount: 4, createdAt: "2026-10-01T00:00:00Z" }],
      photos: [{ reviewId: 7, storageKey: "reviews/7.webp", thumbStorageKey: null }],
    });

    await expect(getReviewBlock(41)).resolves.toMatchObject({
      summary: {
        average: 4.3,
        count: 4,
        recommendPercent: 100,
        fit: { small: 17, true: 17, large: 66 },
        photos: [{ reviewId: "7", url: "https://media.example/reviews/7.webp" }],
      },
      top: [{ author: { displayName: "Giulia R." }, verifiedPurchase: true }],
    });
  });

  it("paginates reviews without repeating the summary", async () => {
    repository.findReviews.mockResolvedValue({
      rows: [{ id: 8, orderItemId: null, verifiedPurchase: 0, rating: 4, authorDisplayName: "Ava" }],
      photos: [],
      total: 21,
    });

    await expect(getReviews(41, { page: 2, limit: 10 })).resolves.toMatchObject({
      items: [{ id: "8", verifiedPurchase: false, author: { displayName: "Ava" } }],
      pagination: { page: 2, limit: 10, total: 21, totalPages: 3 },
    });
  });
});
