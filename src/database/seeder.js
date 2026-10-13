import path from "node:path";
import { fileURLToPath } from "node:url";

import { SequelizeStorage, Umzug } from "umzug";

import { sequelize } from "../config/database.js";

import { logger } from "../config/logger.js";

/*
|--------------------------------------------------------------------------
| Paths
|--------------------------------------------------------------------------
*/

const filename = fileURLToPath(import.meta.url);

const directory = path.dirname(filename);

/*
|--------------------------------------------------------------------------
| Core Seeder Runner
|--------------------------------------------------------------------------
|
| Core seeders contain mandatory application data.
|
| Examples:
|
| - Languages
| - Roles
| - Permissions
| - System settings
| - Initial Super Admin
|
| These are different from demo seeders.
|
*/

export const coreSeeder = new Umzug({
  migrations: {
    glob: [
      "*.seeder.js",

      {
        cwd: path.join(directory, "seeders", "core"),
      },
    ],
  },

  context: sequelize.getQueryInterface(),

  /*
   * IMPORTANT:
   *
   * Migration history and Seeder history
   * must NOT share the same metadata table.
   *
   * Migration:
   * SequelizeMeta
   *
   * Core Seeder:
   * sequelize_core_seed_meta
   */

  storage: new SequelizeStorage({
    sequelize,

    modelName: "SequelizeCoreSeedMeta",

    tableName: "sequelize_core_seed_meta",
  }),

  logger: {
    info: (event) =>
      logger.info({
        event,

        component: "core-seeders",
      }),

    warn: (event) =>
      logger.warn({
        event,

        component: "core-seeders",
      }),

    error: (event) =>
      logger.error({
        event,

        component: "core-seeders",
      }),

    debug: (event) =>
      logger.debug({
        event,

        component: "core-seeders",
      }),
  },
});
