import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "../..");
const fixtureFile = path.join(
  projectRoot,
  "docs",
  "sql",
  "home-feed-test-data.sql",
);
const environmentArgument = process.argv.find((argument) =>
  argument.startsWith("--environment="),
);
const environment = environmentArgument?.slice("--environment=".length);

if (!new Set(["development", "test"]).has(environment)) {
  throw new Error(
    "Use --environment=development or --environment=test when applying the Home-feed fixture.",
  );
}

const environmentFile = path.join(projectRoot, `.env.${environment}`);

function splitSqlStatements(sql) {
  const statements = [];
  let current = "";
  let quote = null;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index];
    const nextCharacter = sql[index + 1];

    if (lineComment) {
      current += character;
      if (character === "\n") {
        lineComment = false;
      }
      continue;
    }

    if (blockComment) {
      current += character;
      if (character === "*" && nextCharacter === "/") {
        current += nextCharacter;
        index += 1;
        blockComment = false;
      }
      continue;
    }

    if (quote) {
      current += character;
      if (character === "\\") {
        current += nextCharacter ?? "";
        index += 1;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }

    if (
      character === "-" &&
      nextCharacter === "-" &&
      (index === 0 || /\s/.test(sql[index - 1]))
    ) {
      current += `${character}${nextCharacter}`;
      index += 1;
      lineComment = true;
      continue;
    }

    if (character === "/" && nextCharacter === "*") {
      current += `${character}${nextCharacter}`;
      index += 1;
      blockComment = true;
      continue;
    }

    if (character === "'" || character === '"' || character === "`") {
      quote = character;
      current += character;
      continue;
    }

    if (character === ";") {
      if (current.trim()) {
        statements.push(current.trim());
      }
      current = "";
      continue;
    }

    current += character;
  }

  if (current.trim()) {
    statements.push(current.trim());
  }

  return statements;
}

function executableStatement(statement) {
  return statement
    .replace(/^[ \t]*--[^\n]*(?:\n|$)/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .trim();
}

function assertFixturePrerequisites(preflight) {
  const expectedCounts = {
    audience_categories: 3,
    demo_products: 4,
    products_with_approved_images: 4,
    featured_brands: 2,
    home_demo_brands: 6,
  };

  const missing = Object.entries(expectedCounts)
    .filter(([key, expected]) => Number(preflight?.[key]) !== expected)
    .map(
      ([key, expected]) =>
        `${key}: expected ${expected}, found ${preflight?.[key] ?? 0}`,
    );

  if (missing.length > 0) {
    throw new Error(
      `Home-feed fixture prerequisites are missing (${missing.join("; ")}). Run the demo catalog and starter-image setup first.`,
    );
  }
}

if (!fs.existsSync(environmentFile)) {
  throw new Error(
    `Home-feed fixture requires ${environmentFile}.`,
  );
}

if (!fs.existsSync(fixtureFile)) {
  throw new Error(`Home-feed test fixture file was not found: ${fixtureFile}.`);
}

const dotenvResult = dotenv.config({
  path: environmentFile,
  override: true,
  quiet: true,
});

if (dotenvResult.error) {
  throw new Error(
    `Unable to load the test environment file: ${dotenvResult.error.message}`,
  );
}

process.env.NODE_ENV = environment;

const [{ connectDatabase, disconnectDatabase, sequelize }, { logger }, { safeErrorForLog }] =
  await Promise.all([
    import("../config/database.js"),
    import("../config/logger.js"),
    import("../utils/safe-error.js"),
  ]);

async function run() {
  const statements = splitSqlStatements(fs.readFileSync(fixtureFile, "utf8"));
  let databaseConnected = false;
  let transaction;
  let preflight;
  let placementCount;

  try {
    await connectDatabase();
    databaseConnected = true;
    transaction = await sequelize.transaction();

    for (const statement of statements) {
      const sql = executableStatement(statement);
      const type = sql.toUpperCase();

      if (!type) {
        continue;
      }

      if (type === "START TRANSACTION" || type === "COMMIT") {
        continue;
      }

      const [rows] = await sequelize.query(sql, { transaction });

      if (type.startsWith("SELECT")) {
        const firstRow = Array.isArray(rows) ? rows[0] : null;

        if (firstRow?.audience_categories !== undefined) {
          preflight = firstRow;
          assertFixturePrerequisites(preflight);
        }

        if (firstRow?.test_home_placement_count !== undefined) {
          placementCount = Number(firstRow.test_home_placement_count);
        }
      }
    }

    if (placementCount < 10) {
      throw new Error(
        `Expected at least 10 Home-feed test placements, but found ${placementCount ?? 0}.`,
      );
    }

    await transaction.commit();
    transaction = null;

    logger.info(
      {
        fixture: "home-feed-test-data",
        environment,
        placementCount,
      },
      "Home-feed test fixture applied successfully",
    );
  } catch (error) {
    if (transaction) {
      await transaction.rollback().catch(() => undefined);
    }
    throw error;
  } finally {
    if (databaseConnected) {
      await disconnectDatabase();
    }
  }
}

run().catch((error) => {
  logger.fatal(
    {
      component: "home-feed-test-fixture",
      error: safeErrorForLog(error),
    },
    "Home-feed test fixture failed",
  );
  process.exitCode = 1;
});
