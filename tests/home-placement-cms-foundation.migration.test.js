import { describe, expect, it, vi } from "vitest";

import {
  down,
  up,
} from "../src/database/migrations/202610070043-expand-home-placements-for-cms.js";

describe("home placement CMS foundation migration", () => {
  it("adds CMS metadata, audit references, and supporting indexes", async () => {
    const queryInterface = {
      addColumn: vi.fn(),
      addIndex: vi.fn(),
      removeColumn: vi.fn(),
      removeIndex: vi.fn(),
    };

    await up({ context: queryInterface });

    expect(queryInterface.addColumn).toHaveBeenCalledWith(
      "home_placements",
      "link_path",
      expect.objectContaining({ allowNull: true }),
    );
    expect(queryInterface.addColumn).toHaveBeenCalledWith(
      "home_placements",
      "offer_payload",
      expect.objectContaining({ allowNull: true }),
    );
    expect(queryInterface.addColumn).toHaveBeenCalledWith(
      "home_placements",
      "source",
      expect.objectContaining({ defaultValue: "admin" }),
    );
    expect(queryInterface.addColumn).toHaveBeenCalledWith(
      "home_placements",
      "published_by_account_id",
      expect.objectContaining({
        allowNull: true,
        references: { model: "accounts", key: "id" },
      }),
    );
    expect(queryInterface.addIndex).toHaveBeenCalledWith(
      "home_placements",
      ["source", "status"],
      { name: "idx_home_placements_source_status" },
    );

    await down({ context: queryInterface });

    expect(queryInterface.removeIndex).toHaveBeenCalledWith(
      "home_placements",
      "idx_home_placements_published_by",
    );
    expect(queryInterface.removeColumn).toHaveBeenCalledWith(
      "home_placements",
      "link_path",
    );
  });
});
