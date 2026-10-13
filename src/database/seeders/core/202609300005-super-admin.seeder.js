import bcrypt from "bcryptjs";
import { QueryTypes } from "sequelize";
import { z } from "zod";

/*
|--------------------------------------------------------------------------
| Initial Super Admin Seeder
|--------------------------------------------------------------------------
|
| Purpose:
|
| 1. Read bootstrap admin credentials from environment variables.
| 2. Validate them.
| 3. Find the system "super_admin" role.
| 4. Create the initial administrator account.
| 5. Hash the password before storing it.
| 6. Assign the "super_admin" role through account_roles.
|
| Nothing sensitive is hardcoded in source code.
|
*/

/*
|--------------------------------------------------------------------------
| Password Hashing Cost
|--------------------------------------------------------------------------
|
| bcrypt cost factor 12 gives us a sensible security baseline.
|
| This is NOT a password or secret, so it is safe to keep in source code.
|
*/

const BCRYPT_ROUNDS = 12;

/*
|--------------------------------------------------------------------------
| Seeder Environment Validation
|--------------------------------------------------------------------------
|
| These values are intentionally validated here instead of in the global
| application env schema.
|
| Reason:
|
| SUPER_ADMIN_PASSWORD is only required while bootstrapping the database.
| The running API should not permanently depend on the original password.
|
*/

const SuperAdminConfigSchema = z.object({
  SUPER_ADMIN_EMAIL: z
    .string()
    .trim()
    .email("SUPER_ADMIN_EMAIL must be a valid email address")
    .transform((value) => value.toLowerCase()),

  SUPER_ADMIN_PASSWORD: z
    .string()
    .min(12, "SUPER_ADMIN_PASSWORD must contain at least 12 characters")
    .max(128, "SUPER_ADMIN_PASSWORD must not exceed 128 characters")
    .refine((value) => value !== "SET_A_STRONG_UNIQUE_PASSWORD_HERE", {
      message: "Replace the default SUPER_ADMIN_PASSWORD placeholder",
    }),

  SUPER_ADMIN_FIRST_NAME: z
    .string()
    .trim()
    .min(1, "SUPER_ADMIN_FIRST_NAME is required")
    .max(100, "SUPER_ADMIN_FIRST_NAME must not exceed 100 characters"),

  SUPER_ADMIN_LAST_NAME: z
    .string()
    .trim()
    .min(1, "SUPER_ADMIN_LAST_NAME is required")
    .max(100, "SUPER_ADMIN_LAST_NAME must not exceed 100 characters"),
});

/*
|--------------------------------------------------------------------------
| Read Seeder Configuration
|--------------------------------------------------------------------------
*/

function getSuperAdminConfig() {
  const result = SuperAdminConfigSchema.safeParse(process.env);

  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");

    throw new Error(`Invalid super admin seed configuration: ${message}`);
  }

  return {
    email: result.data.SUPER_ADMIN_EMAIL,

    password: result.data.SUPER_ADMIN_PASSWORD,

    firstName: result.data.SUPER_ADMIN_FIRST_NAME,

    lastName: result.data.SUPER_ADMIN_LAST_NAME,
  };
}

/*
|--------------------------------------------------------------------------
| Read Email For Rollback
|--------------------------------------------------------------------------
|
| Rollback does not need the original plain password.
|
*/

function getSuperAdminEmail() {
  const result = z
    .string()
    .trim()
    .email()
    .safeParse(process.env.SUPER_ADMIN_EMAIL);

  if (!result.success) {
    throw new Error(
      "SUPER_ADMIN_EMAIL is required to rollback the super admin seeder",
    );
  }

  return result.data.toLowerCase();
}

/*
|--------------------------------------------------------------------------
| Seeder UP
|--------------------------------------------------------------------------
*/

export async function up({ context: queryInterface }) {
  /*
  |--------------------------------------------------------------------------
  | Read And Validate Configuration
  |--------------------------------------------------------------------------
  */

  const config = getSuperAdminConfig();

  /*
  |--------------------------------------------------------------------------
  | Hash Password
  |--------------------------------------------------------------------------
  |
  | Plain password must NEVER be inserted into the database.
  |
  */

  const passwordHash = await bcrypt.hash(config.password, BCRYPT_ROUNDS);

  /*
  |--------------------------------------------------------------------------
  | Start Transaction
  |--------------------------------------------------------------------------
  |
  | Account creation + role assignment must succeed together.
  |
  | If anything fails:
  |
  | everything rolls back.
  |
  */

  const transaction = await queryInterface.sequelize.transaction();

  try {
    /*
    |--------------------------------------------------------------------------
    | Find Super Admin Role
    |--------------------------------------------------------------------------
    |
    | Never use:
    |
    | role_id = 1
    |
    | IDs can differ between databases.
    |
    | Stable code is the source of truth.
    |
    */

    const roles = await queryInterface.sequelize.query(
      `
            SELECT
              id,
              code,
              scope,
              is_system,
              is_active
            FROM roles
            WHERE code = :roleCode
              AND scope = :scope
              AND is_system = 1
              AND is_active = 1
              AND deleted_at IS NULL
            LIMIT 1
          `,
      {
        replacements: {
          roleCode: "super_admin",

          scope: "platform",
        },

        type: QueryTypes.SELECT,

        transaction,
      },
    );

    const superAdminRole = roles[0];

    if (!superAdminRole) {
      throw new Error(
        'Required active system role "super_admin" was not found',
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Protect Existing Accounts
    |--------------------------------------------------------------------------
    |
    | Security rule:
    |
    | If an account with this email already exists, we DO NOT automatically
    | promote that account to super_admin.
    |
    | Why?
    |
    | Imagine this email already belongs to a customer or another account.
    | Silently adding super_admin would become a privilege-escalation risk.
    |
    */

    const existingAccounts = await queryInterface.sequelize.query(
      `
            SELECT
              id,
              email
            FROM accounts
            WHERE email = :email
            LIMIT 1
          `,
      {
        replacements: {
          email: config.email,
        },

        type: QueryTypes.SELECT,

        transaction,
      },
    );

    if (existingAccounts.length > 0) {
      throw new Error(
        `Account "${config.email}" already exists. Refusing to automatically promote an existing account to super_admin.`,
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Create Account
    |--------------------------------------------------------------------------
    */

    const now = new Date();

    await queryInterface.bulkInsert(
      "accounts",
      [
        {
          email: config.email,

          password_hash: passwordHash,

          first_name: config.firstName,

          last_name: config.lastName,

          status: "active",

          /*
           * Bootstrap super administrator is created by the system operator,
           * so it is considered verified.
           */

          email_verified_at: now,

          last_login_at: null,

          created_at: now,

          updated_at: now,
        },
      ],
      {
        transaction,
      },
    );

    /*
    |--------------------------------------------------------------------------
    | Read Newly Created Account
    |--------------------------------------------------------------------------
    |
    | We fetch by unique email instead of depending on database-specific
    | bulkInsert return values.
    |
    */

    const createdAccounts = await queryInterface.sequelize.query(
      `
            SELECT
              id,
              email
            FROM accounts
            WHERE email = :email
            LIMIT 1
          `,
      {
        replacements: {
          email: config.email,
        },

        type: QueryTypes.SELECT,

        transaction,
      },
    );

    const account = createdAccounts[0];

    if (!account) {
      throw new Error(
        "Super admin account was inserted but could not be loaded",
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Assign Super Admin Role
    |--------------------------------------------------------------------------
    */

    await queryInterface.bulkInsert(
      "account_roles",
      [
        {
          account_id: account.id,

          role_id: superAdminRole.id,

          created_at: now,

          updated_at: now,
        },
      ],
      {
        transaction,
      },
    );

    /*
    |--------------------------------------------------------------------------
    | Commit
    |--------------------------------------------------------------------------
    */

    await transaction.commit();
  } catch (error) {
    /*
    |--------------------------------------------------------------------------
    | Rollback Everything
    |--------------------------------------------------------------------------
    |
    | We never want:
    |
    | account created
    | but
    | super_admin role missing
    |
    */

    await transaction.rollback();

    throw error;
  }
}

/*
|--------------------------------------------------------------------------
| Seeder DOWN
|--------------------------------------------------------------------------
|
| Development rollback support.
|
| Do NOT casually rollback this seeder in a live production database.
|
*/

export async function down({ context: queryInterface }) {
  const email = getSuperAdminEmail();

  const transaction = await queryInterface.sequelize.transaction();

  try {
    /*
    |--------------------------------------------------------------------------
    | Find Account
    |--------------------------------------------------------------------------
    */

    const accounts = await queryInterface.sequelize.query(
      `
            SELECT
              id,
              email
            FROM accounts
            WHERE email = :email
            LIMIT 1
          `,
      {
        replacements: {
          email,
        },

        type: QueryTypes.SELECT,

        transaction,
      },
    );

    const account = accounts[0];

    /*
     * Already absent = rollback has nothing to do.
     */

    if (!account) {
      await transaction.commit();

      return;
    }

    /*
    |--------------------------------------------------------------------------
    | Find Super Admin Role
    |--------------------------------------------------------------------------
    */

    const roles = await queryInterface.sequelize.query(
      `
            SELECT
              id
            FROM roles
            WHERE code = :roleCode
            LIMIT 1
          `,
      {
        replacements: {
          roleCode: "super_admin",
        },

        type: QueryTypes.SELECT,

        transaction,
      },
    );

    const superAdminRole = roles[0];

    /*
    |--------------------------------------------------------------------------
    | Remove Seeder Role Mapping
    |--------------------------------------------------------------------------
    */

    if (superAdminRole) {
      await queryInterface.bulkDelete(
        "account_roles",
        {
          account_id: account.id,

          role_id: superAdminRole.id,
        },
        {
          transaction,
        },
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Protect Account If It Has Other Roles
    |--------------------------------------------------------------------------
    |
    | Example:
    |
    | if somebody later assigned another role to this account,
    | rollback should not destroy that account automatically.
    |
    */

    const roleCounts = await queryInterface.sequelize.query(
      `
            SELECT
              COUNT(*) AS role_count
            FROM account_roles
            WHERE account_id = :accountId
          `,
      {
        replacements: {
          accountId: account.id,
        },

        type: QueryTypes.SELECT,

        transaction,
      },
    );

    const remainingRoleCount = Number(roleCounts[0]?.role_count ?? 0);

    /*
    |--------------------------------------------------------------------------
    | Delete Account Only If No Other Roles Remain
    |--------------------------------------------------------------------------
    */

    if (remainingRoleCount === 0) {
      await queryInterface.bulkDelete(
        "accounts",
        {
          id: account.id,
        },
        {
          transaction,
        },
      );
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();

    throw error;
  }
}
