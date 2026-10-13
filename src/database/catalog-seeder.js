import { SequelizeStorage, Umzug } from "umzug";

import { sequelize } from "../config/database.js";

import { logger } from "../config/logger.js";

export const catalogSeeder = new Umzug({
  migrations: {
    glob: "src/database/seeders/catalog/*.seeder.js",
  },

  context: sequelize.getQueryInterface(),

  storage: new SequelizeStorage({
    sequelize,

    modelName: "SequelizeCatalogSeedMeta",

    tableName: "sequelize_catalog_seed_meta",
  }),

  logger: {
    info(event) {
      logger.info(
        {
          event,
          component: "catalog-seeders",
        },
        "Catalog seeder event",
      );
    },

    warn(event) {
      logger.warn(
        {
          event,
          component: "catalog-seeders",
        },
        "Catalog seeder warning",
      );
    },

    error(event) {
      logger.error(
        {
          event,
          component: "catalog-seeders",
        },
        "Catalog seeder error",
      );
    },

    debug(event) {
      logger.debug(
        {
          event,
          component: "catalog-seeders",
        },
        "Catalog seeder debug",
      );
    },
  },
});

export default catalogSeeder;
