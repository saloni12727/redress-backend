import { describe, expect, it, vi } from "vitest";

import { runDevelopmentDatabaseSync } from "../src/database/development-sync.service.js";

function runner(prefix) {
  return {
    up: vi.fn().mockResolvedValue([{ name: `${prefix}-applied` }]),
    executed: vi.fn().mockResolvedValue([{ name: `${prefix}-executed` }]),
    pending: vi.fn().mockResolvedValue([]),
  };
}

describe("development database sync", () => {
  it("runs migrations, required seeders, a snapshot, and final statuses", async () => {
    const migrator = runner("migration");
    const coreSeeder = runner("core");
    const catalogSeeder = runner("catalog");
    const connectDatabase = vi.fn();
    const disconnectDatabase = vi.fn();
    const writeSnapshot = vi.fn().mockResolvedValue({
      outputPath: "database/schema.latest.sql",
      tableCount: 3,
      tables: ["accounts", "roles", "permissions"],
    });
    const logger = { info: vi.fn() };

    const result = await runDevelopmentDatabaseSync({
      env: { NODE_ENV: "development" },
      logger,
      connectDatabase,
      disconnectDatabase,
      migrator,
      coreSeeder,
      catalogSeeder,
      writeSnapshot,
    });

    expect(result.applied).toEqual({
      migrations: ["migration-applied"],
      coreSeeders: ["core-applied"],
      catalogSeeders: ["catalog-applied"],
    });
    expect(writeSnapshot).toHaveBeenCalledOnce();
    expect(disconnectDatabase).toHaveBeenCalledOnce();
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ component: "db-sync-dev" }),
      "Development database synchronized successfully",
    );
  });

  it("refuses to change a non-development database", async () => {
    const connectDatabase = vi.fn();

    await expect(
      runDevelopmentDatabaseSync({
        env: { NODE_ENV: "production" },
        logger: { info: vi.fn() },
        connectDatabase,
        disconnectDatabase: vi.fn(),
        migrator: runner("migration"),
        coreSeeder: runner("core"),
        catalogSeeder: runner("catalog"),
      }),
    ).rejects.toThrow("db:sync:dev can only run when NODE_ENV is development");

    expect(connectDatabase).not.toHaveBeenCalled();
  });
});
