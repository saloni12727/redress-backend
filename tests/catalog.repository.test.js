import { afterEach, describe, expect, it, vi } from "vitest";

import { sequelize } from "../src/config/database.js";

import { findPublicProducts } from "../src/modules/catalog/catalog.repository.js";
import { findTopReviews } from "../src/modules/catalog/catalog.reviews.repository.js";

function filters(overrides = {}) {
  return {
    page: 1,
    limit: 20,
    q: undefined,
    category: undefined,
    audience: undefined,
    brand: [],
    color: [],
    size: [],
    fit: [],
    minPrice: undefined,
    maxPrice: undefined,
    minDiscount: undefined,
    onSale: undefined,
    tryOn: undefined,
    featured: undefined,
    inStock: undefined,
    sort: "featured",
    locale: "en",
    fallbackLocale: "it",
    ...overrides,
  };
}

describe("catalog repository public visibility", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("always constrains listings to publishable products and vendors", async () => {
    const query = vi.spyOn(sequelize, "query");
    query
      .mockResolvedValueOnce([{ total: "0" }])
      .mockResolvedValueOnce([]);

    await findPublicProducts(filters());

    const sql = query.mock.calls.map(([statement]) => statement).join("\n");

    expect(sql).toContain("product.status = 'published'");
    expect(sql).toContain("product.approval_status = 'approved'");
    expect(sql).toContain("product.visibility = 'public'");
    expect(sql).toContain("product.published_at IS NOT NULL");
    expect(sql).toContain("vendor.status = 'active'");
    expect(sql).toContain("vendor.approval_status = 'approved'");
    expect(sql).toContain("media.moderation_status = 'approved'");
    expect(sql).not.toContain("cost_price");
  });

  it("keeps all variant filters within one matching variant", async () => {
    const query = vi.spyOn(sequelize, "query");
    query
      .mockResolvedValueOnce([{ total: "0" }])
      .mockResolvedValueOnce([]);

    await findPublicProducts(
      filters({
        color: ["black"],
        size: ["12"],
        minPrice: "20.00",
        maxPrice: "80.00",
        inStock: true,
      }),
    );

    const listSql = query.mock.calls[1][0];
    const options = query.mock.calls[1][1];

    expect(listSql.match(/FROM product_variants filtered_variant/g)).toHaveLength(
      1,
    );
    expect(listSql).toContain("filtered_size.code IN (:sizeCodes)");
    expect(listSql).toContain("filtered_color.code IN (:colorCodes)");
    expect(listSql).toContain("filtered_inventory.allow_backorder = 1");
    expect(options.replacements).toMatchObject({
      colorCodes: ["black"],
      sizeCodes: ["12"],
      minPrice: "20.00",
      maxPrice: "80.00",
    });
  });

  it("filters and sorts real active discounts using sale prices", async () => {
    const query = vi.spyOn(sequelize, "query");
    query
      .mockResolvedValueOnce([{ total: "0" }])
      .mockResolvedValueOnce([]);

    await findPublicProducts(filters({ minDiscount: 30, sort: "discount" }));

    const [countSql, listSql] = query.mock.calls.map(([statement]) => statement);
    const options = query.mock.calls[0][1];

    expect(countSql).toContain(">= :minDiscount");
    expect(listSql).toContain("ORDER BY COALESCE((");
    expect(listSql).toContain("variant.sale_start_at");
    expect(options.replacements).toMatchObject({ minDiscount: 30 });
  });

  it("limits a wishlist listing to the authenticated account and newest saves", async () => {
    const query = vi.spyOn(sequelize, "query");
    query
      .mockResolvedValueOnce([{ total: "0" }])
      .mockResolvedValueOnce([]);

    await findPublicProducts(filters({ wishlistAccountId: "42" }));

    const [countSql, listSql] = query.mock.calls.map(([statement]) => statement);
    const options = query.mock.calls[0][1];

    expect(countSql).toContain("INNER JOIN wishlist_items wishlist_item");
    expect(listSql).toContain(
      "ORDER BY wishlist_item.created_at DESC, wishlist_item.id DESC",
    );
    expect(options.replacements).toMatchObject({ wishlistAccountId: "42" });
  });
});

describe("catalog review repository", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requires the linked order item and customer to match before verifying a purchase", async () => {
    const query = vi.spyOn(sequelize, "query");
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await findTopReviews(41);

    const reviewSql = query.mock.calls[0][0];
    expect(reviewSql).toContain("LEFT JOIN order_items review_order_item");
    expect(reviewSql).toContain("LEFT JOIN orders review_order");
    expect(reviewSql).toContain("review_order_item.product_id = review.product_id");
    expect(reviewSql).toContain("review_order.account_id = review.account_id");
  });
});
