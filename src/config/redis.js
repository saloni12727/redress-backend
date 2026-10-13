import Redis from "ioredis";

import { env } from "./env.js";
import { logger } from "./logger.js";

let redisClient = null;
let redisConnected = false;

function createRedisClient() {
  const client = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    enableReadyCheck: true,
    connectTimeout: env.REDIS_CONNECT_TIMEOUT_MS,
    maxRetriesPerRequest: null,
  });

  client.on("error", (error) => {
    logger.error(
      {
        error: {
          name: error.name,
          message: error.message,
          code: error.code,
        },
        component: "redis",
      },
      "Redis client error",
    );
  });

  client.on("reconnecting", () => {
    logger.warn({ component: "redis" }, "Redis reconnecting");
  });

  return client;
}

export function isRedisEnabled() {
  return env.REDIS_ENABLED;
}

export function redisKey(key) {
  return `${env.REDIS_KEY_PREFIX}${key}`;
}

export function getRedisClient() {
  if (!env.REDIS_ENABLED) {
    throw new Error("Redis is disabled by configuration");
  }

  if (!redisClient) {
    redisClient = createRedisClient();
  }

  return redisClient;
}

export async function connectRedis() {
  if (!env.REDIS_ENABLED) {
    logger.warn({ component: "redis" }, "Redis is disabled");
    return;
  }

  const client = getRedisClient();

  try {
    if (client.status === "wait") {
      await client.connect();
    }

    await client.ping();
    redisConnected = true;

    logger.info({ component: "redis" }, "Redis connected successfully");
  } catch (error) {
    redisConnected = false;
    client.disconnect(false);
    redisClient = null;

    logger.error(
      {
        error: {
          name: error.name,
          message: error.message,
          code: error.code,
        },
        component: "redis",
      },
      "Redis connection failed",
    );

    throw error;
  }
}

export async function checkRedisConnection() {
  if (!env.REDIS_ENABLED) {
    return {
      enabled: false,
      healthy: true,
      status: "disabled",
    };
  }

  if (!redisClient || !redisConnected) {
    return {
      enabled: true,
      healthy: false,
      status: "down",
    };
  }

  try {
    await redisClient.ping();

    return {
      enabled: true,
      healthy: true,
      status: "up",
    };
  } catch {
    return {
      enabled: true,
      healthy: false,
      status: "down",
    };
  }
}

export async function disconnectRedis() {
  if (!redisClient) {
    return;
  }

  const client = redisClient;
  redisClient = null;
  redisConnected = false;

  try {
    if (!["end", "close"].includes(client.status)) {
      await client.quit();
    }

    logger.info({ component: "redis" }, "Redis connection closed");
  } catch (error) {
    client.disconnect(false);

    logger.error(
      {
        error: {
          name: error.name,
          message: error.message,
          code: error.code,
        },
        component: "redis",
      },
      "Redis shutdown failed",
    );

    throw error;
  }
}
