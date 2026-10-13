import { Queue } from "bullmq";

import { env } from "./env.js";
import { getRedisClient, isRedisEnabled } from "./redis.js";

const queues = new Map();

export const queueNames = Object.freeze({
  BODY_MEASUREMENT: "body-measurement",
  VIRTUAL_TRY_ON: "virtual-try-on",
});

export function getQueue(name, options = {}) {
  if (!isRedisEnabled()) {
    throw new Error(`Cannot create queue ${name}: Redis is disabled`);
  }

  if (!queues.has(name)) {
    const { defaultJobOptions = {}, ...queueOptions } = options;

    queues.set(
      name,
      new Queue(name, {
        ...queueOptions,
        connection: getRedisClient(),
        // BullMQ requires its own prefix; ioredis keyPrefix is incompatible.
        prefix: env.REDIS_KEY_PREFIX.replace(/:+$/, ""),
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 1000,
          },
          removeOnComplete: {
            age: 86400,
            count: 1000,
          },
          removeOnFail: {
            age: 604800,
            count: 5000,
          },
          ...defaultJobOptions,
        },
      }),
    );
  }

  return queues.get(name);
}

export async function closeQueues() {
  const activeQueues = [...queues.values()];
  queues.clear();

  await Promise.all(activeQueues.map((queue) => queue.close()));
}
