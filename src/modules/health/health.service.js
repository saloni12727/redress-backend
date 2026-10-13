import { checkDatabaseConnection } from "../../config/database.js";
import { checkRedisConnection } from "../../config/redis.js";

export function getLivenessStatus() {
  return {
    healthy: true,
    status: "ok",
  };
}

export async function getReadinessStatus() {
  const [databaseHealthy, redis] = await Promise.all([
    checkDatabaseConnection(),
    checkRedisConnection(),
  ]);

  const healthy = databaseHealthy && redis.healthy;

  return {
    healthy,
    status: healthy ? "ready" : "not_ready",
    dependencies: {
      database: databaseHealthy ? "up" : "down",
      redis: redis.status,
    },
  };
}
