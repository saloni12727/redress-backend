import { describe, expect, it, vi } from "vitest";

import {
  down,
  up,
} from "../src/database/migrations/202610060042-create-home-placements.js";

describe("home placements migration", () => {
  it("creates scheduled, typed Home placements with feed indexes", async () => {
    const queryInterface = {
      createTable: vi.fn(),
      addIndex: vi.fn(),
      dropTable: vi.fn(),
    };

    await up({ context: queryInterface });

    expect(queryInterface.createTable).toHaveBeenCalledWith(
      "home_placements",
      expect.objectContaining({
        section_key: expect.objectContaining({ allowNull: false }),
        target_type: expect.objectContaining({ allowNull: false }),
        target_filters: expect.any(Object),
        image_storage_key: expect.any(Object),
        starts_at: expect.any(Object),
        ends_at: expect.any(Object),
      }),
    );
    expect(queryInterface.addIndex).toHaveBeenCalledWith(
      "home_placements",
      ["section_key", "status", "starts_at", "ends_at", "sort_order"],
      { name: "idx_home_placements_feed" },
    );

    await down({ context: queryInterface });
    expect(queryInterface.dropTable).toHaveBeenCalledWith("home_placements");
  });
});
