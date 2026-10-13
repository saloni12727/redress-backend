import { afterEach, describe, expect, it, vi } from "vitest";

import { sequelize } from "../src/config/database.js";

import { findLiveHomePlacements } from "../src/modules/home/home.repository.js";

describe("home repository", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns only live placements whose catalog targets remain public", async () => {
    const query = vi.spyOn(sequelize, "query").mockResolvedValue([]);

    await findLiveHomePlacements();

    const [sql] = query.mock.calls[0];

    expect(sql).toContain("placement.section_key IN");
    expect(sql).toContain("placement.status = 'live'");
    expect(sql).toContain("placement.starts_at <= UTC_TIMESTAMP()");
    expect(sql).toContain("placement.ends_at > UTC_TIMESTAMP()");
    expect(sql).toContain("target_product.status = 'published'");
    expect(sql).toContain("target_product.approval_status = 'approved'");
    expect(sql).toContain("target_product.visibility = 'public'");
    expect(sql).toContain("target_vendor.status = 'active'");
    expect(sql).toContain("target_brand.is_active = 1");
    expect(sql).toContain("target_category.is_active = 1");
  });
});
