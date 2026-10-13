## Env related rules

Do not change Values of ENV ever even if it exposes to you because its Dev /Test related things are there

if your implemenation requires new variables in Env then you can add New Variabels in Env

DO not create .env.example

use existing env files

## API Response Format Rules

All APIs must return responses using a consistent, professional, and predictable JSON structure.

The standard response format must be:

```json
{
  "success": true,
  "data": {},
  "message": "Operation completed successfully."
}
```

The following fields are mandatory in every API response:

- `success`: Boolean value indicating whether the request was successful.
- `data`: Contains the requested result or response payload. Use `null` when no data is available.
- `message`: A clear, professional, human-readable message describing the result.

### 1. Successful Response

For successful operations:

```json
{
  "success": true,
  "data": {
    "id": 123,
    "name": "John Doe"
  },
  "message": "User details retrieved successfully."
}
```

If the operation succeeds but there is no data to return:

```json
{
  "success": true,
  "data": null,
  "message": "Operation completed successfully."
}
```

### 2. Validation or Failed Response

For validation failures, invalid requests, authentication issues, authorization failures, or other expected business-level failures:

```json
{
  "success": false,
  "data": null,
  "message": "Your session is invalid or has expired."
}
```

Another example:

```json
{
  "success": false,
  "data": null,
  "message": "The provided email address is already registered."
}
```

### 3. Server/Error Response

For unexpected server-side errors:

```json
{
  "success": false,
  "data": null,
  "message": "An unexpected error occurred. Please try again later."
}
```

Never expose internal exception messages, stack traces, database errors, file paths, SQL queries, environment variables, tokens, or any sensitive implementation details in API responses.

### General Rules

All APIs must follow these rules consistently:

- Always return `success`, `data`, and `message`.
- `success` must always be a boolean: `true` or `false`.
- For successful requests, use `"success": true`.
- For failed or errored requests, use `"success": false`.
- Use `data: null` when there is no meaningful response data.
- Do not return empty or inconsistent properties such as `result`, `response`, `status`, `errorMessage`, or `msg` instead of the standard structure.
- Do not return different response formats from different controllers or modules.
- Messages must be clear, professional, concise, and grammatically correct.
- Avoid technical messages intended only for developers.
- Use appropriate HTTP status codes together with the standard JSON response format.
- Do not expose sensitive information in success or error responses.
- Validation errors should clearly explain what input is incorrect without revealing internal implementation details.
- Authentication and authorization responses should not disclose unnecessary security information.
- Existing and newly created APIs must follow the same response convention.

### Recommended HTTP Status Codes

Use standard HTTP status codes appropriately:

- `200` — Successful request
- `201` — Resource created successfully
- `400` — Invalid request or validation failure
- `401` — Authentication required or session/token invalid
- `403` — User is authenticated but does not have permission
- `404` — Requested resource not found
- `409` — Resource conflict or duplicate data
- `422` — Unprocessable input when applicable
- `500` — Unexpected internal server error

Example authentication failure:

```json
{
  "success": false,
  "data": null,
  "message": "Your session is invalid or has expired."
}
```

Example resource not found:

```json
{
  "success": false,
  "data": null,
  "message": "The requested user could not be found."
}
```

Example create operation:

```json
{
  "success": true,
  "data": {
    "id": 123
  },
  "message": "User created successfully."
}
```

The response structure must remain consistent across all APIs, including authentication, CRUD operations, file uploads, payments, integrations, admin APIs, mobile APIs, and third-party API integrations.

## Database Migration Mode

Two modes are supported: `MODEL_FIRST_DEVELOPMENT` and `MIGRATION_FIRST`.

Current mode: `MODEL_FIRST_DEVELOPMENT`.

- `MODEL_FIRST_DEVELOPMENT`: modify Sequelize models/base schema directly; do NOT create new migration files for normal schema changes.

- In this mode, absorb required changes from temporary migrations into models/seeds/bootstrap logic, then delete those obsolete migration files.

- `MIGRATION_FIRST`: for persistent UAT/production databases, create a new migration for every schema change AND update the corresponding Sequelize models.

- Never switch modes automatically; follow the explicitly configured current mode.

## Migration <-> Model Sync Policy (If Mode is `MIGRATION_FIRST` )

### Objective

Every schema migration that changes table structure must be reflected in the corresponding Sequelize model files in the same delivery pass.

### Mandatory Rule

If you change any DB structure in a migration, update the model definitions before merge, including:

1. Column add/remove

2. Column rename

3. Datatype change

4. Nullability/default change

5. Enum value change

6. Index/unique constraints that affect model validation behavior

7. Table drop/merge, where the model must be retired or remapped

### Applied Migration Immutability

1. Applied migrations are immutable history.

2. Do not modify an applied migration to repair a database that has already recorded that filename in `tbl_migrations`.

3. Add a new migration for corrections, backfills, constraints, indexes, defaults, seed/base-data adjustments, or safety guards.

4. New corrective migrations must be idempotent where practical, using existence checks for tables, columns, indexes, constraints, and seed records.

5. If a previous migration must remain compatible with fresh database builds, preserve it as committed and add the compatibility repair in the next migration.

### Source Of Truth

1. Migrations are the source of truth for schema history and fresh DB reconstruction.

2. Models are the source of truth for runtime ORM behavior.

3. Both must stay aligned in the same PR.

### Runtime Enforcement

1. `npm run dev_migrate`
   - applies pending migrations

   - prints migration summary counts

   - runs model/schema drift guard

2. Drift guard script: `src/scripts/model_timestamp_guard.js`
   - checks model expected columns vs DB columns

   - auto-fixes only safe timestamp drift when enabled

   - never auto-edits model JS files

3. Timestamp auto-fix default:
   - development: ON (`MODEL_TIMESTAMP_AUTO_FIX=1` default)

   - test/production: OFF (`MODEL_TIMESTAMP_AUTO_FIX=0` default)

4. Strict drift failure default:
   - development: OFF (`MODEL_SCHEMA_STRICT=0` default)

   - test/production: ON (`MODEL_SCHEMA_STRICT=1` default)

### Guard Commands

1. `npm run dev_model_guard`

2. `npm run dev_model_guard:fix`

3. `npm run dev_model_guard:strict`

### Required Delivery Checklist For Schema Changes

1. Add migration file with idempotent checks where needed.

2. Update affected Sequelize model(s) in the same change.

3. Update seed/bootstrap source if the schema or runtime base data requires it.

4. Run `npm run dev_migrate`.

5. Verify drift guard output is clean, or only expected safe timestamp drift was auto-fixed.

6. Run an application flow that touches the changed tables.

### Fresh DB Rule

1. Do not delete migration files.

2. Fresh DB must be created via migrations.

3. `sequelize.sync()` or alter-sync is not a replacement for migration history.
