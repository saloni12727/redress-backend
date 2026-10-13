import path from "node:path";
import { fileURLToPath } from "node:url";

import { SequelizeStorage, Umzug } from "umzug";

import { sequelize } from "../config/database.js";
import { logger } from "../config/logger.js";

const filename = fileURLToPath(import.meta.url);
const directory = path.dirname(filename);

export const migrator = new Umzug({
  migrations: {
    glob: ["*.js", { cwd: path.join(directory, "migrations") }],
  },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize }),
  logger: {
    info: (event) => logger.info({ event, component: "migrations" }),
    warn: (event) => logger.warn({ event, component: "migrations" }),
    error: (event) => logger.error({ event, component: "migrations" }),
    debug: (event) => logger.debug({ event, component: "migrations" }),
  },
});
