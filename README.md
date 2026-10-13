# Redress Backend

Public Node.js API and orchestration service for the Redress AI-powered,
multi-vendor fashion marketplace.

## Requirements

- Node.js 22.12 or newer
- MySQL 8+
- Redis 7+ when background AI jobs are enabled
- PM2 installed globally when using the PM2 commands below

## Run with PM2

This project uses native Node.js ES modules and does not have a transpilation
step. `npm run build` validates the OpenAPI contract before deployment; it
does not produce compiled files. Install production dependencies with
`npm ci --omit=dev` after validation.

The PM2 configuration is in [`ecosystem.config.cjs`](./ecosystem.config.cjs).
It starts the application with the Node executable running PM2, so PM2 does
not depend on a potentially different `node` in its `PATH`.

### Development

```sh
npm run dev
pm2 start ecosystem.config.cjs --only redress-backend-development
pm2 logs redress-backend-development
pm2 stop redress-backend-development
```

### Test

`npm run test` starts the persistent API using `.env.test` and explicitly sets
`NODE_ENV=test`. It is not the automated test suite.

```sh
npm run test
pm2 start ecosystem.config.cjs --only redress-backend-test
pm2 logs redress-backend-test
pm2 restart redress-backend-test --update-env
pm2 stop redress-backend-test
```

The startup bootstrap requires `.env.test` and loads it over inherited
shell/PM2 environment variables. Configure `.env.test` with a test database,
test Redis namespace, and non-production credentials. Keep `.env.test`
private.

Run the automated test suite separately:

```sh
npm run test:unit
npm run test:unit:watch
```

### Production

Configure the production environment (`.env.production` or the hosting
environment variables) before starting. Production does not fall back to
development `.env` settings.

```sh
npm run build
npm ci --omit=dev
npm run prod
pm2 start ecosystem.config.cjs --only redress-backend-production --env production
pm2 logs redress-backend-production
```

Use `pm2 restart redress-backend-production --update-env` to restart after
changing deployment environment variables, `pm2 stop redress-backend-production`
to stop the service, and `pm2 delete redress-backend-production` to remove it
from PM2.

## Local setup

1. Copy `.env.example` to `.env.development` and supply local credentials.
2. Install packages with `npm install`.
3. Check pending migrations with `npm run db:migrate:status`.
4. Apply migrations with `npm run db:migrate`.
5. Start development mode with `npm run dev`.

Redis can be disabled for UI-only local development by setting
`REDIS_ENABLED=false`. Production configuration requires Redis and secure JWT
cookies. Production never falls back to values from `.env`.

## Browser CORS

Set `CORS_ORIGINS` to a comma-separated list of trusted **origins** (scheme,
host, and optional port only; no paths), for example:

```dotenv
CORS_ORIGINS=https://redress.cyberimpulses.com,https://www.redress.cyberimpulses.com,https://redressbackend.cyberimpulses.com
```

These Redress production origins are also trusted by default. In development
and test only, HTTP/HTTPS origins on `localhost`, `127.0.0.1`, and `[::1]` are
accepted on any port (including the local frontend/backend ports 4108 and 3108).
Production does not implicitly trust loopback origins; add any additional
production frontend origin explicitly to `CORS_ORIGINS`. Requests from native
Flutter, Postman, curl, and server-to-server clients without an `Origin` header
do not use browser CORS and are allowed through this middleware.

Swagger UI uses a same-host, root-relative OpenAPI server URL based on
`API_PREFIX`. Open the docs on localhost during development or on the deployed
backend in production; its "Try it out" requests automatically target the host
serving the documentation rather than a hard-coded production URL.

Profile-photo uploads require S3 `PutObject` access for the configured
`profiles/` prefix. S3 `DeleteObject` is used separately when users delete or
replace an existing photo; it is not a precondition for uploading a new photo.
If delete access is unavailable, a replacement upload still succeeds and the
backend logs the failed old-object cleanup for operations follow-up.

## Private image delivery

Profile, catalog, brand, vendor, and home-feed images are returned as opaque,
short-lived API media URLs. The backend decrypts and validates each URL token,
then streams the image from the private S3 bucket; it never redirects clients
to S3. This keeps the bucket hostname and storage key out of API responses.
Treat these URLs as bearer links: they expire within 15 minutes and should not
be shared. Delivery is proxied through the API and therefore consumes backend
bandwidth.

Set `API_PUBLIC_ORIGIN` when the API must return URLs on a non-default host:

```dotenv
API_PUBLIC_ORIGIN=https://redressbackend.cyberimpulses.com
```

The production default is the Redress backend host. Development defaults to
`http://localhost:<PORT>`; set `API_PUBLIC_ORIGIN` to the machine's LAN origin
when testing from a physical Flutter device, since `localhost` on that device
refers to the device itself.

## Continue with Google

Set the OAuth client IDs created in the same Google Cloud project:

```dotenv
GOOGLE_WEB_CLIENT_ID=
GOOGLE_ANDROID_CLIENT_ID=
GOOGLE_IOS_CLIENT_ID=
```

These client IDs are public identifiers; do not put a Google client secret in
the API request or mobile/web application. Native apps that request an ID token
for this backend should use the Web client ID as their server client ID. The
Android and iOS IDs remain approved audiences for platform-issued tokens.

After Google sign-in succeeds on the client, send the ID token—not a Google
access token or plain Google user ID—to the API:

```http
POST /api/v1/auth/google
Content-Type: application/json

{
  "idToken": "GOOGLE_ID_TOKEN",
  "deviceType": "android",
  "deviceName": "Pixel"
}
```

The backend verifies Google's signature, issuer, expiry, and audience, then
uses Google's stable `sub` claim as the external identity. New users receive a
passwordless customer account. Existing customer accounts are auto-linked by
email only when Google is authoritative for the address (Gmail or Google
Workspace). Other pre-existing email matches are rejected with
`google_link_requires_existing_auth` so the client can ask the user to sign in
with the account's existing method instead of linking by email alone.

Google profile data is used only when a Redress account is first created or
first linked. Later Google logins never overwrite a name or photo edited in
Redress.

## Public catalog

Catalog discovery is public and shared by Flutter and Next.js. Responses use
Italian by default; send `Accept-Language: en` or `?lang=en` for English.
The filters endpoint is the preferred one-call bootstrap for a product browse
screen.

```http
GET /api/v1/catalog/brands
GET /api/v1/catalog/categories
GET /api/v1/catalog/filters
GET /api/v1/catalog/products?page=1&limit=20&category=women&brand=modaviva&inStock=true
GET /api/v1/catalog/products/floral-midi-dress
```

Product lists support localized search, descendant-aware category filtering,
brand/color/size/fit filters, price ranges, stock/featured flags, and stable
sorting. Repeat multi-value parameters or separate them with commas. Use size
IDs returned by `/catalog/filters` because labels such as `40` can belong to
different size systems.

Only published, approved, publicly visible products from active approved
vendors are exposed. Product media must also be approved. S3 object keys, cost
prices, exact inventory quantities, and other internal fields are never
returned. Media URLs are short-lived signed URLs and should be refreshed by
refetching the relevant catalog response after expiry.

## Public Home feed

Flutter should load the Home screen from one public, localized endpoint:

```http
GET /api/v1/home/feed?lang=en
```

The endpoint returns localized Home sections (`banners`, `audiences`, `brands`,
`studio`, `promo`, `lookbook`, and product/editorial rails) with typed
destinations. Admins choose targets by ID; the public feed returns safe
navigation links rather than arbitrary client-side paths. Empty placement
arrays are intentional until matching approved Home creative has been
published; product rails continue to work independently.

Home cards return `imageUrl` and accessible `alt` text. Feed image URLs are
short-lived; refresh the feed if one expires. The public Home card does not
return admin asset keys or image dimensions. The endpoint's response follows:

```json
{
  "success": true,
  "data": {},
  "message": "Home feed retrieved successfully."
}
```

Home creative is stored as scheduled `home_placements` records. It is live
only during its configured date range and never exposes a product, brand, or
category that is no longer public. Platform administrators manage it through
the authenticated Home CMS endpoints below; shoppers and sellers do not have
write access in Phase 1:

```http
GET    /api/v1/admin/home/placements
POST   /api/v1/admin/home/placements
GET    /api/v1/admin/home/placements/:id
PATCH  /api/v1/admin/home/placements/:id
POST   /api/v1/admin/home/placements/:id/publish
POST   /api/v1/admin/home/placements/:id/archive
DELETE /api/v1/admin/home/placements/:id
```

Each endpoint requires a valid admin access token and its corresponding
`platform.home_content.*` permission. Creating or updating a placement never
publishes it; publishing is explicit, validates its target, schedule,
localized content, and section-specific image, and may schedule a future
campaign. The Home CMS routes use the standard `{ success, data, message }`
response envelope and are documented in Swagger. The
[Flutter Home API handoff](docs/home-flutter-handoff.md) contains the complete
feed response, all placement request/response contracts, permissions, and
Admin-to-shopper flow.

## Current-user profile and contact changes

All endpoints below require a Bearer access token.

```http
GET /api/v1/auth/me

PATCH /api/v1/auth/me
Content-Type: application/json

{
  "firstName": "Ada",
  "lastName": "Lovelace",
  "locale": "en"
}
```

`displayName` is returned by the API but is not editable. It is derived from
`firstName` and `lastName`, while the legacy database column is kept in sync.
Send `lastName: null` for a single-name profile.

Profile photos are uploaded through the authenticated backend. Send raw JPEG,
PNG or WebP bytes (maximum 8 MiB). The backend validates the real image format,
removes metadata, converts the image to WebP and stores it in the private S3
bucket. The returned `photoUrl` is a short-lived signed URL.

The backend AWS identity must have `s3:PutObject`, `s3:GetObject` and
`s3:DeleteObject` for the configured profile prefix. Uploads fail before a new
object is created when delete permission is missing, preventing undeletable
profile images.

An IAM policy template is available at
`docs/aws-profile-photo-iam-policy.json`; replace `YOUR_BUCKET_NAME` before
attaching it to the backend IAM identity.

```http
PUT /api/v1/auth/me/photo
Authorization: Bearer ACCESS_TOKEN
Content-Type: image/jpeg

<binary image bytes>

DELETE /api/v1/auth/me/photo
Authorization: Bearer ACCESS_TOKEN
```

Email and phone are verified identifiers and therefore cannot be changed with
`PATCH /auth/me`. Use the account-bound OTP flows instead:

```http
POST /api/v1/auth/email/change/request
{ "newEmail": "new@example.com" }

POST /api/v1/auth/email/change/verify
{ "newEmail": "new@example.com", "otp": "123456" }

POST /api/v1/auth/phone/change/request
{ "newPhone": "+393331234567" }

POST /api/v1/auth/phone/change/verify
{ "newPhone": "+393331234567", "otp": "123456" }
```

Contact-change requests require a recently authenticated session. A client
receiving `REAUTHENTICATION_REQUIRED` should complete its normal login flow
again and retry. The existing verified contact remains active until the new
destination's OTP is successfully consumed. After a contact changes, all
other sessions are revoked.

## OpenAPI contract

Interactive Swagger documentation, including Try it out support, is available
at:

```http
https://redressbackend.cyberimpulses.com/api/v1/docs
```

The raw OpenAPI 3.1 document is available at:

```http
GET /api/v1/docs/openapi.json
```

Validate the committed document with `npm run openapi:check`. A repeatable,
development-only live flow is available as `npm run smoke:auth-profile`; it
creates and removes its own temporary account and refuses to start unless the
configured S3 identity can delete profile-photo objects.

## Commands

```text
npm run dev                 Start with Nodemon
npm start                   Start normally
npm test                    Run the test suite once
npm run test:watch          Run tests in watch mode
npm run smoke:catalog       Read-only live catalog smoke check
npm run db:migrate          Apply pending migrations
npm run db:migrate:undo     Revert the latest migration
npm run db:migrate:status   List executed and pending migrations
npm run db:sync:dev          Development-only migration, master-data, and schema-reference setup
```

## Health endpoints

All endpoints use the configured API prefix, which defaults to `/api/v1`.

- `GET /api/v1/health/live` checks whether the HTTP process is alive.
- `GET /api/v1/health/ready` checks MySQL and Redis readiness.
- `GET /api/v1/health` remains a backwards-compatible readiness endpoint.

Use the liveness endpoint for process restart decisions and readiness for load
balancer traffic decisions.

## Database changes

Schema changes are made only through files in
`src/database/migrations`. Do not use `sequelize.sync()` or
`sequelize.sync({ alter: true })`.

A migration module exports `up` and `down` functions and receives the Sequelize
query interface as its context:

```js
export async function up({ context: queryInterface }) {
  // Apply schema change.
}

export async function down({ context: queryInterface }) {
  // Revert schema change.
}
```

For a new or existing development database, use `npm run db:sync:dev`. It:

- refuses to run outside `NODE_ENV=development`;
- applies pending migrations;
- applies core and catalog master-data seeders only;
- writes the derived no-data reference snapshot at `database/schema.latest.sql`;
- reports final migration and seeder status.

It never calls `sequelize.sync()`, never runs demo seeders, and never uploads
starter products. Incremental migrations remain the only schema source of
truth; the SQL snapshot is a review/reference artifact.

## Security defaults

- Environment values are validated before startup.
- CORS uses an explicit allowlist and credentialed wildcard origins are denied.
- Request bodies and credentials are redacted from structured logs.
- API responses contain stable `errorCode` and `messageKey` values.
- Rate limiting is active unless explicitly disabled outside production.
- Database TLS is available through the `DB_SSL_*` variables.
- Secrets and `.env.*` files are ignored; only `.env.example` is committed.
