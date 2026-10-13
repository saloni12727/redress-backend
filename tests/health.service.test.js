import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/config/database.js", () => ({
  checkDatabaseConnection: vi.fn(),
}));

vi.mock("../src/config/redis.js", () => ({
  checkRedisConnection: vi.fn(),
}));

import { checkDatabaseConnection } from "../src/config/database.js";
import { checkRedisConnection } from "../src/config/redis.js";
import {
  getLivenessStatus,
  getReadinessStatus,
} from "../src/modules/health/health.service.js";

describe("health service", () => {
  beforeEach(() => {
    checkDatabaseConnection.mockResolvedValue(true);
    checkRedisConnection.mockResolvedValue({
      enabled: true,
      healthy: true,
      status: "up",
    });
  });

  it("reports liveness without dependencies", () => {
    expect(getLivenessStatus()).toEqual({
      healthy: true,
      status: "ok",
    });
  });

  it("reports ready when dependencies are healthy", async () => {
    await expect(getReadinessStatus()).resolves.toEqual({
      healthy: true,
      status: "ready",
      dependencies: {
        database: "up",
        redis: "up",
      },
    });
  });

  it("reports not ready when a dependency is down", async () => {
    checkRedisConnection.mockResolvedValue({
      enabled: true,
      healthy: false,
      status: "down",
    });

    await expect(getReadinessStatus()).resolves.toMatchObject({
      healthy: false,
      status: "not_ready",
      dependencies: {
        redis: "down",
      },
    });
  });
});
