import { DataTypes } from "sequelize";

import {
  connectDatabase,
  disconnectDatabase,
  sequelize,
} from "../config/database.js";

import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import ContentPolicy from "../models/content-policy.model.js";
import { safeErrorForLog } from "../utils/safe-error.js";

/*
|--------------------------------------------------------------------------
| Development Signup / Fit Database Preparation
|--------------------------------------------------------------------------
|
| DEVELOPMENT ONLY.
|
| This script safely prepares the current development database for the
| signup + consent + fit setup flow.
|
| It is idempotent:
|
| - Existing columns are not recreated
| - Existing tables are not recreated
| - Existing Privacy Policy is not overwritten
|
| It does NOT touch:
|
| - Auth business logic
| - OTP
| - Google authentication
| - Home CMS
| - Categories
| - Brands
| - Vendors
| - Products
| - Existing S3/media configuration
|
*/

const ACCOUNT_COLUMNS = {
  consent_privacy_accepted_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },

  consent_privacy_version: {
    type: DataTypes.STRING(64),
    allowNull: true,
  },

  consent_channel: {
    type: DataTypes.STRING(32),
    allowNull: true,
  },

  fit_setup_skipped_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
};

/*
|--------------------------------------------------------------------------
| Development Privacy Policy
|--------------------------------------------------------------------------
|
| Temporary content for development/testing.
|
| Replace with the approved legal Privacy Policy before production.
|
*/

const DEVELOPMENT_PRIVACY_POLICY = {
  id: "privacy",

  title: "Privacy Policy",

  sections: [
    {
      heading: "Development privacy notice",

      body: "This is temporary development content used to test the Redress signup consent flow. Replace it with the approved production Privacy Policy before release.",
    },

    {
      heading: "Fit setup",

      body: "Fit setup is optional. Measurement photos used for estimation are processed temporarily and are not stored. Profile photos are stored privately when the shopper chooses to save them.",
    },

    {
      heading: "Your choice",

      body: "You can skip fit setup and continue using Redress. Saved account and fit information is handled according to the final approved Redress Privacy Policy.",
    },
  ],

  isPublished: true,
};

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

async function tableExists(tableName) {
  const queryInterface = sequelize.getQueryInterface();

  const tables = await queryInterface.showAllTables();

  return tables.some(
    (table) => String(table).toLowerCase() === tableName.toLowerCase(),
  );
}

async function indexExists(tableName, indexName) {
  const queryInterface = sequelize.getQueryInterface();

  const indexes = await queryInterface.showIndex(tableName);

  return indexes.some((index) => index.name === indexName);
}

/*
|--------------------------------------------------------------------------
| Account Columns
|--------------------------------------------------------------------------
*/

async function ensureAccountSignupColumns() {
  const queryInterface = sequelize.getQueryInterface();

  const currentColumns = await queryInterface.describeTable("accounts");

  const addedColumns = [];

  for (const [columnName, definition] of Object.entries(ACCOUNT_COLUMNS)) {
    if (currentColumns[columnName]) {
      continue;
    }

    await queryInterface.addColumn("accounts", columnName, definition);

    addedColumns.push(columnName);
  }

  return addedColumns;
}

/*
|--------------------------------------------------------------------------
| User Consents
|--------------------------------------------------------------------------
|
| Signup stores legal consent history here.
|
*/

async function ensureUserConsentsTable() {
  const queryInterface = sequelize.getQueryInterface();

  if (await tableExists("user_consents")) {
    return {
      created: false,
    };
  }

  await queryInterface.createTable("user_consents", {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,

      allowNull: false,

      autoIncrement: true,

      primaryKey: true,
    },

    account_id: {
      type: DataTypes.BIGINT.UNSIGNED,

      allowNull: false,

      references: {
        model: "accounts",
        key: "id",
      },

      onUpdate: "CASCADE",

      onDelete: "CASCADE",
    },

    kind: {
      type: DataTypes.STRING(32),

      allowNull: false,

      defaultValue: "privacy",
    },

    version: {
      type: DataTypes.STRING(64),

      allowNull: false,
    },

    accepted_at: {
      type: DataTypes.DATE,

      allowNull: false,
    },

    channel: {
      type: DataTypes.STRING(32),

      allowNull: false,
    },

    created_at: {
      type: DataTypes.DATE,

      allowNull: false,
    },
  });

  await queryInterface.addIndex(
    "user_consents",

    ["account_id", "kind", "accepted_at"],

    {
      name: "idx_user_consents_account_kind",
    },
  );

  return {
    created: true,
  };
}

/*
|--------------------------------------------------------------------------
| Shopper Media
|--------------------------------------------------------------------------
|
| This is separate from the existing public/product media.
|
| It stores metadata for private shopper body photos.
|
*/

async function ensureShopperMediaTable() {
  const queryInterface = sequelize.getQueryInterface();

  if (await tableExists("shopper_media")) {
    return {
      created: false,
    };
  }

  await queryInterface.createTable("shopper_media", {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,

      allowNull: false,

      autoIncrement: true,

      primaryKey: true,
    },

    account_id: {
      type: DataTypes.BIGINT.UNSIGNED,

      allowNull: false,

      references: {
        model: "accounts",
        key: "id",
      },

      onUpdate: "CASCADE",

      onDelete: "CASCADE",
    },

    purpose: {
      type: DataTypes.STRING(32),

      allowNull: false,
    },

    storage_key: {
      type: DataTypes.STRING(500),

      allowNull: false,

      unique: true,
    },

    mime_type: {
      type: DataTypes.STRING(100),

      allowNull: false,
    },

    width: {
      type: DataTypes.INTEGER.UNSIGNED,

      allowNull: true,
    },

    height: {
      type: DataTypes.INTEGER.UNSIGNED,

      allowNull: true,
    },

    size_bytes: {
      type: DataTypes.INTEGER.UNSIGNED,

      allowNull: false,
    },

    attached_at: {
      type: DataTypes.DATE,

      allowNull: true,
    },

    created_at: {
      type: DataTypes.DATE,

      allowNull: false,
    },

    updated_at: {
      type: DataTypes.DATE,

      allowNull: false,
    },

    deleted_at: {
      type: DataTypes.DATE,

      allowNull: true,
    },
  });

  await queryInterface.addIndex(
    "shopper_media",

    ["account_id", "purpose", "attached_at"],

    {
      name: "idx_shopper_media_owner_purpose_attachment",
    },
  );

  await queryInterface.addIndex(
    "shopper_media",

    ["created_at"],

    {
      name: "idx_shopper_media_created",
    },
  );

  return {
    created: true,
  };
}

/*
|--------------------------------------------------------------------------
| Body Profiles
|--------------------------------------------------------------------------
|
| Supports:
|
| self
| partner
| child
| other
|
| There can be only ONE live `self` profile per account.
|
| Other profile relations can have multiple rows.
|
*/

async function ensureBodyProfilesTable() {
  const queryInterface = sequelize.getQueryInterface();

  if (await tableExists("body_profiles")) {
    return {
      created: false,
    };
  }

  await queryInterface.createTable("body_profiles", {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,

      allowNull: false,

      autoIncrement: true,

      primaryKey: true,
    },

    account_id: {
      type: DataTypes.BIGINT.UNSIGNED,

      allowNull: false,

      references: {
        model: "accounts",
        key: "id",
      },

      onUpdate: "CASCADE",

      onDelete: "CASCADE",
    },

    name: {
      type: DataTypes.STRING(40),

      allowNull: false,
    },

    relation: {
      type: DataTypes.STRING(16),

      allowNull: false,
    },

    /*
     * MySQL does not support a normal partial
     * unique index.
     *
     * For relation=self this stores account_id.
     * For all other relations it stays NULL.
     *
     * Unique index therefore allows:
     *
     * one self
     * many partner/child/other
     */

    self_owner_key: {
      type: DataTypes.BIGINT.UNSIGNED,

      allowNull: true,
    },

    is_default: {
      type: DataTypes.BOOLEAN,

      allowNull: false,

      defaultValue: false,
    },

    sex: {
      type: DataTypes.STRING(16),

      allowNull: true,
    },

    height_cm: {
      type: DataTypes.DECIMAL(5, 1),

      allowNull: true,
    },

    weight_kg: {
      type: DataTypes.DECIMAL(5, 1),

      allowNull: true,
    },

    shoulders_cm: {
      type: DataTypes.DECIMAL(5, 1),

      allowNull: true,
    },

    chest_cm: {
      type: DataTypes.DECIMAL(5, 1),

      allowNull: true,
    },

    waist_cm: {
      type: DataTypes.DECIMAL(5, 1),

      allowNull: true,
    },

    hips_cm: {
      type: DataTypes.DECIMAL(5, 1),

      allowNull: true,
    },

    inseam_cm: {
      type: DataTypes.DECIMAL(5, 1),

      allowNull: true,
    },

    arm_length_cm: {
      type: DataTypes.DECIMAL(5, 1),

      allowNull: true,
    },

    shoe_eu: {
      type: DataTypes.DECIMAL(4, 1),

      allowNull: true,
    },

    foot_length_cm: {
      type: DataTypes.DECIMAL(5, 1),

      allowNull: true,
    },

    front_media_id: {
      type: DataTypes.BIGINT.UNSIGNED,

      allowNull: true,
    },

    back_media_id: {
      type: DataTypes.BIGINT.UNSIGNED,

      allowNull: true,
    },

    left_media_id: {
      type: DataTypes.BIGINT.UNSIGNED,

      allowNull: true,
    },

    right_media_id: {
      type: DataTypes.BIGINT.UNSIGNED,

      allowNull: true,
    },

    avatar_media_id: {
      type: DataTypes.BIGINT.UNSIGNED,

      allowNull: true,
    },

    stylist: {
      type: DataTypes.JSON,

      allowNull: true,
    },

    created_at: {
      type: DataTypes.DATE,

      allowNull: false,
    },

    updated_at: {
      type: DataTypes.DATE,

      allowNull: false,
    },

    deleted_at: {
      type: DataTypes.DATE,

      allowNull: true,
    },
  });

  await queryInterface.addIndex(
    "body_profiles",

    ["account_id", "is_default"],

    {
      name: "idx_body_profiles_account_default",
    },
  );

  await queryInterface.addIndex(
    "body_profiles",

    ["account_id", "updated_at"],

    {
      name: "idx_body_profiles_account_updated",
    },
  );

  await queryInterface.addIndex(
    "body_profiles",

    ["self_owner_key"],

    {
      name: "uq_body_profiles_live_self",

      unique: true,
    },
  );

  return {
    created: true,
  };
}

/*
|--------------------------------------------------------------------------
| Content Policies
|--------------------------------------------------------------------------
*/

async function ensureContentPoliciesTable() {
  const queryInterface = sequelize.getQueryInterface();

  if (await tableExists("content_policies")) {
    return {
      created: false,
    };
  }

  await queryInterface.createTable("content_policies", {
    id: {
      type: DataTypes.STRING(64),

      allowNull: false,

      primaryKey: true,
    },

    title: {
      type: DataTypes.STRING(191),

      allowNull: false,
    },

    sections: {
      type: DataTypes.JSON,

      allowNull: false,
    },

    is_published: {
      type: DataTypes.BOOLEAN,

      allowNull: false,

      defaultValue: true,
    },

    created_at: {
      type: DataTypes.DATE,

      allowNull: false,
    },

    updated_at: {
      type: DataTypes.DATE,

      allowNull: false,
    },
  });

  return {
    created: true,
  };
}

/*
|--------------------------------------------------------------------------
| Privacy Policy
|--------------------------------------------------------------------------
*/

async function ensureDevelopmentPrivacyPolicy() {
  const existing = await ContentPolicy.findByPk("privacy");

  /*
   * Never modify an already-existing
   * Privacy Policy.
   */

  if (existing) {
    return {
      created: false,

      isPublished: Boolean(existing.isPublished),

      updatedAt: existing.updatedAt
        ? new Date(existing.updatedAt).toISOString()
        : null,
    };
  }

  const policy = await ContentPolicy.create(DEVELOPMENT_PRIVACY_POLICY);

  return {
    created: true,

    isPublished: Boolean(policy.isPublished),

    updatedAt: policy.updatedAt
      ? new Date(policy.updatedAt).toISOString()
      : null,
  };
}

/*
|--------------------------------------------------------------------------
| Existing Table Validation
|--------------------------------------------------------------------------
|
| If a table already exists, we leave it untouched.
|
| We only ensure indexes when necessary for body_profiles.
|
*/

async function ensureExistingBodyProfileIndexes() {
  if (!(await tableExists("body_profiles"))) {
    return [];
  }

  const queryInterface = sequelize.getQueryInterface();

  const addedIndexes = [];

  const requiredIndexes = [
    {
      name: "idx_body_profiles_account_default",

      fields: ["account_id", "is_default"],

      unique: false,
    },

    {
      name: "idx_body_profiles_account_updated",

      fields: ["account_id", "updated_at"],

      unique: false,
    },

    {
      name: "uq_body_profiles_live_self",

      fields: ["self_owner_key"],

      unique: true,
    },
  ];

  for (const index of requiredIndexes) {
    if (await indexExists("body_profiles", index.name)) {
      continue;
    }

    await queryInterface.addIndex(
      "body_profiles",

      index.fields,

      {
        name: index.name,

        unique: index.unique,
      },
    );

    addedIndexes.push(index.name);
  }

  return addedIndexes;
}

/*
|--------------------------------------------------------------------------
| Run
|--------------------------------------------------------------------------
*/

async function run() {
  /*
   * Never allow this helper to run against
   * production.
   */

  if (env.NODE_ENV !== "development") {
    throw new Error(
      "prepare-signup-development can only run when NODE_ENV=development.",
    );
  }

  await connectDatabase();

  try {
    /*
     * Accounts
     */

    const addedAccountColumns = await ensureAccountSignupColumns();

    /*
     * Required new signup / fit tables.
     */

    const contentPolicies = await ensureContentPoliciesTable();

    const userConsents = await ensureUserConsentsTable();

    const shopperMedia = await ensureShopperMediaTable();

    const bodyProfiles = await ensureBodyProfilesTable();

    /*
     * Index validation.
     */

    const addedBodyProfileIndexes = bodyProfiles.created
      ? []
      : await ensureExistingBodyProfileIndexes();

    /*
     * Base development privacy content.
     */

    const privacyPolicy = await ensureDevelopmentPrivacyPolicy();

    logger.info(
      {
        component: "signup-development-preparation",

        addedAccountColumns,

        tables: {
          contentPolicies,

          userConsents,

          shopperMedia,

          bodyProfiles,
        },

        addedBodyProfileIndexes,

        privacyPolicy,
      },

      "Signup and fit development database preparation completed successfully",
    );

    if (!privacyPolicy.isPublished) {
      logger.warn(
        {
          component: "signup-development-preparation",

          policyId: "privacy",
        },

        "Privacy Policy exists but is unpublished. Signup consent cannot complete until the policy is published.",
      );
    }
  } finally {
    await disconnectDatabase();
  }
}

/*
|--------------------------------------------------------------------------
| Execute
|--------------------------------------------------------------------------
*/

run().catch((error) => {
  logger.fatal(
    {
      component: "signup-development-preparation",

      error: safeErrorForLog(error, {
        includeStack: true,
      }),
    },

    "Signup and fit development database preparation failed",
  );

  process.exitCode = 1;
});
