import fs from "node:fs";

import { QueryTypes, Sequelize } from "sequelize";

import { env } from "./env.js";
import { logger } from "./logger.js";

import { safeErrorForLog } from "../utils/safe-error.js";

/*
|--------------------------------------------------------------------------
| Dialect Options
|--------------------------------------------------------------------------
*/

function createDialectOptions() {
  const options = {
    connectTimeout: env.DB_CONNECT_TIMEOUT_MS,
  };

  /*
   * SSL remains optional because local/dev
   * environments may not require it.
   */

  if (env.DB_SSL_ENABLED) {
    options.ssl = {
      rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED,
    };

    if (env.DB_SSL_CA_PATH) {
      options.ssl.ca = fs.readFileSync(env.DB_SSL_CA_PATH, "utf8");
    }
  }

  return options;
}

/*
|--------------------------------------------------------------------------
| Sequelize
|--------------------------------------------------------------------------
|
| MODEL_FIRST_DEVELOPMENT:
|
| The development bootstrap may use a plain sequelize.sync() to create
| missing model tables. It must never use alter sync; production remains
| migration-managed.
|
*/

export const sequelize = new Sequelize(
  env.DB_NAME,
  env.DB_USER,
  env.DB_PASSWORD,
  {
    host: env.DB_HOST,

    port: env.DB_PORT,

    dialect: "mysql",

    /*
     * Store timestamps in UTC.
     */

    timezone: "+00:00",

    /*
     * SQL logging stays disabled by default.
     */

    logging: false,

    /*
     * Connection pool.
     */

    pool: {
      max: env.DB_POOL_MAX,

      min: env.DB_POOL_MIN,

      acquire: env.DB_POOL_ACQUIRE_MS,

      idle: env.DB_POOL_IDLE_MS,
    },

    dialectOptions: createDialectOptions(),

    /*
     * Default model conventions.
     */

    define: {
      timestamps: true,

      underscored: true,

      freezeTableName: true,
    },
  },
);

let connected = false;

/*
|--------------------------------------------------------------------------
| Connect
|--------------------------------------------------------------------------
*/

export async function connectDatabase() {
  try {
    await sequelize.authenticate();

    connected = true;

    logger.info(
      {
        component: "database",
      },
      "Database connected successfully",
    );
  } catch (error) {
    connected = false;

    logger.error(
      {
        component: "database",

        error: safeErrorForLog(error, {
          includeStack: env.NODE_ENV !== "production",
        }),
      },
      "Database connection failed",
    );

    throw error;
  }
}

/*
|--------------------------------------------------------------------------
| Health Check
|--------------------------------------------------------------------------
*/

export async function checkDatabaseConnection() {
  try {
    await sequelize.query("SELECT 1", {
      type: QueryTypes.SELECT,

      raw: true,
    });

    return true;
  } catch {
    return false;
  }
}

/*
|--------------------------------------------------------------------------
| Disconnect
|--------------------------------------------------------------------------
*/

export async function disconnectDatabase() {
  if (!connected) {
    return;
  }

  try {
    await sequelize.close();

    connected = false;

    logger.info(
      {
        component: "database",
      },
      "Database connection closed",
    );
  } catch (error) {
    logger.error(
      {
        component: "database",

        error: safeErrorForLog(error, {
          includeStack: env.NODE_ENV !== "production",
        }),
      },
      "Database shutdown failed",
    );

    throw error;
  }
}
