import { SequelizeStorage, Umzug } from "umzug";

import { sequelize } from "../config/database.js";

import { logger } from "../config/logger.js";

export const demoSeeder = new Umzug({
  migrations: {
    glob: "src/database/seeders/demo/*.seeder.js",
  },

  context: sequelize.getQueryInterface(),

  storage: new SequelizeStorage({
    sequelize,

    modelName: "SequelizeDemoSeedMeta",

    tableName: "sequelize_demo_seed_meta",
  }),

  logger: {
    info(event) {
      logger.info(
        {
          event,
          component: "demo-seeders",
        },
        "Demo seeder event",
      );
    },

    warn(event) {
      logger.warn(
        {
          event,
          component: "demo-seeders",
        },
        "Demo seeder warning",
      );
    },

    error(event) {
      logger.error(
        {
          event,
          component: "demo-seeders",
        },
        "Demo seeder error",
      );
    },

    debug(event) {
      logger.debug(
        {
          event,
          component: "demo-seeders",
        },
        "Demo seeder debug",
      );
    },
  },
});

export default demoSeeder;
