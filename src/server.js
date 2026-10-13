import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";

import app from "./app.js";

import { connectDatabase, disconnectDatabase } from "./config/database.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { closeQueues } from "./config/queues.js";
import { connectRedis, disconnectRedis } from "./config/redis.js";
import { safeErrorForLog } from "./utils/safe-error.js";

let httpServer = null;
let shuttingDown = false;

function listen(server) {
  return new Promise((resolve, reject) => {
    const handleError = (error) => {
      server.off("listening", handleListening);
      reject(error);
    };

    const handleListening = () => {
      server.off("error", handleError);
      resolve();
    };

    server.once("error", handleError);
    server.once("listening", handleListening);
    server.listen(env.PORT, env.HOST);
  });
}

function closeHttpServer() {
  if (!httpServer?.listening) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    httpServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });

    httpServer.closeIdleConnections?.();
  });
}

async function closeApplicationResources() {
  const failures = [];

  // Ordering matters: workers/queues must release Redis before Redis closes.
  for (const closeResource of [
    closeHttpServer,
    closeQueues,
    disconnectRedis,
    disconnectDatabase,
  ]) {
    try {
      await closeResource();
    } catch (error) {
      failures.push(error);
    }
  }

  if (failures.length > 0) {
    throw new AggregateError(failures, "One or more resources failed to close");
  }
}

export async function startServer() {
  await connectDatabase();

  try {
    await connectRedis();

    httpServer = http.createServer(app);
    httpServer.requestTimeout = env.HTTP_REQUEST_TIMEOUT_MS;
    httpServer.headersTimeout = env.HTTP_HEADERS_TIMEOUT_MS;
    httpServer.keepAliveTimeout = env.HTTP_KEEP_ALIVE_TIMEOUT_MS;

    await listen(httpServer);

    logger.info(
      {
        host: env.HOST,
        port: env.PORT,
        environment: env.NODE_ENV,
        apiPrefix: env.API_PREFIX,
        defaultLanguage: env.APP_DEFAULT_LANGUAGE,
      },
      `${env.APP_NAME} started successfully`,
    );

    return httpServer;
  } catch (error) {
    await closeApplicationResources().catch((cleanupError) => {
      logger.error(
        { error: safeErrorForLog(cleanupError) },
        "Startup cleanup failed",
      );
    });

    throw error;
  }
}

export async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logger.info({ signal }, "Graceful shutdown started");

  let timeout;

  const timeoutPromise = new Promise((resolve, reject) => {
    timeout = setTimeout(() => {
      httpServer?.closeAllConnections?.();
      reject(new Error("Graceful shutdown timed out"));
    }, env.SHUTDOWN_TIMEOUT_MS);

    timeout.unref?.();
  });

  try {
    await Promise.race([closeApplicationResources(), timeoutPromise]);
    logger.info("Graceful shutdown completed");
  } finally {
    clearTimeout(timeout);
    shuttingDown = false;
    httpServer = null;
  }
}

export function registerProcessHandlers() {
  const exitAfterShutdown = (signal, exitCode) => {
    void shutdown(signal)
      .catch((error) => {
        logger.error(
          { error: safeErrorForLog(error, { includeStack: true }) },
          "Graceful shutdown failed",
        );
        exitCode = 1;
      })
      .finally(() => {
        process.exit(exitCode);
      });
  };

  process.once("SIGINT", () => exitAfterShutdown("SIGINT", 0));
  process.once("SIGTERM", () => exitAfterShutdown("SIGTERM", 0));

  process.once("unhandledRejection", (reason) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));

    logger.fatal(
      { error: safeErrorForLog(error, { includeStack: true }) },
      "Unhandled promise rejection",
    );

    exitAfterShutdown("unhandledRejection", 1);
  });

  process.once("uncaughtException", (error) => {
    logger.fatal(
      { error: safeErrorForLog(error, { includeStack: true }) },
      "Uncaught exception",
    );

    exitAfterShutdown("uncaughtException", 1);
  });
}

const isMainModule =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMainModule) {
  registerProcessHandlers();

  startServer().catch((error) => {
    logger.fatal(
      { error: safeErrorForLog(error, { includeStack: true }) },
      "Application startup failed",
    );

    process.exit(1);
  });
}
