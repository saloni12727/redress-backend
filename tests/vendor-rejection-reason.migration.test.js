import { describe, expect, it, vi } from "vitest";

import { down, up } from "../src/database/migrations/202610080044-add-vendor-rejection-reason.js";

describe("vendor rejection-reason migration", () => {
  it("adds and removes the nullable application rejection reason", async () => {
    const queryInterface = { addColumn: vi.fn(), removeColumn: vi.fn() };

    await up({ context: queryInterface });
    expect(queryInterface.addColumn).toHaveBeenCalledWith(
      "vendors",
      "rejection_reason",
      expect.objectContaining({ allowNull: true }),
    );

    await down({ context: queryInterface });
    expect(queryInterface.removeColumn).toHaveBeenCalledWith(
      "vendors",
      "rejection_reason",
    );
  });
});
