# Flutter handoff: Authentication and body profiles

**Audience:** Flutter developers  
**API version:** v1  
**Base URL:** `https://redressbackend.cyberimpulses.com/api/v1`

This document describes the routes currently mounted by the backend for account signup, login, account profile, and shopper body profiles. It is based on the implementation, not a future API proposal.

## 1. Common request and response rules

### Headers

Send these headers on JSON requests:

```http
Accept: application/json
Content-Type: application/json
Accept-Language: it
```

`Accept-Language` supports `it` and `en`. For authenticated endpoints, send:

```http
Authorization: Bearer <accessToken>
```

For multipart requests, send `Accept` and `Authorization` as applicable, but let the HTTP client set `Content-Type` with its generated multipart boundary.

For the consent-aware signup behavior described below, also send this header on `POST /auth/signup` and `POST /auth/google`:

```http
X-App-Contract: signup-consent
```

This header is significant: signup consent validation and the Google `signup_required` handoff are enabled only when its value is exactly `signup-consent`. Flutter should send it on both calls.

### Standard response envelope

Most current endpoints return:

```json
{
  "success": true,
  "data": {},
  "message": "Operation completed successfully."
}
```

Common API errors use:

```json
{
  "success": false,
  "data": null,
  "message": "A human-readable error message.",
  "errorCode": "UNPROCESSABLE",
  "messageKey": "errorUnprocessable",
  "details": {
    "retryable": false,
    "fields": {
      "fieldName": "reason"
    }
  }
}
```

Do not assume all older auth subroutes use this envelope: password and phone/email verification/change endpoints may return a legacy `{ "data": ... }` body, and logout returns HTTP `204` with no body. Some body-profile request-validation failures also return only `success`, `data`, and `message`; service errors use the full error envelope. `GET /body-profiles` returns its `page` object beside `data`, not inside it. See each endpoint below.

## 2. Signup flow

The account is created only after the phone/email OTP or Google proof step. The API does not create a body profile automatically; fit setup is a separate, optional flow after signup.

### Option A: Phone signup

#### 1. Send the OTP

`POST /auth/otp/send` — public, responds `202`.

Request:

```json
{
  "channel": "sms",
  "phone": "+14155550123"
}
```

Use an E.164 phone number. Do not send `email` with `channel: "sms"`.

Response:

```json
{
  "success": true,
  "data": {
    "expiresIn": 300,
    "resendIn": 60
  },
  "message": "The verification code was sent successfully."
}
```

The duration values are server-configured; use the returned values rather than hard-coding them.

#### 2. Verify the OTP

`POST /auth/otp/verify` — public, responds `200`.

Request:

```json
{
  "channel": "sms",
  "phone": "+14155550123",
  "otp": "123456",
  "deviceType": "ios",
  "deviceName": "Ada's iPhone"
}
```

`deviceType` and `deviceName` are optional. `otp` must be six digits. Do not send `email` with `channel: "sms"`.

For a new phone, response data is:

```json
{
  "success": true,
  "data": {
    "status": "signup_required",
    "signupToken": "<short-lived-token>",
    "phone": "+14155550123"
  },
  "message": "The authentication step was completed successfully."
}
```

For an already registered phone, successful OTP verification authenticates the user immediately and returns the authenticated response shown in section 2.4.

### Option B: Email signup

Send an email OTP through the same `POST /auth/otp/send` endpoint:

```json
{
  "channel": "email",
  "email": "ada@example.com"
}
```

Verify it through `POST /auth/otp/verify`:

```json
{
  "channel": "email",
  "email": "ada@example.com",
  "otp": "123456",
  "deviceType": "ios",
  "deviceName": "Ada's iPhone"
}
```

For a new email, the response has `status: "signup_required"` and a `signupToken`, with `email` instead of `phone`. Existing email accounts may return `login_with_password`, `login_with_google`, or `account_exists`; email OTP verification alone does not log an existing email/password user in.

### Option C: Google signup

`POST /auth/google` — public, responds `200`.

Send the Google ID token (not an access token). Include `X-App-Contract: signup-consent`:

```json
{
  "idToken": "<google-id-token>",
  "deviceType": "ios",
  "deviceName": "Ada's iPhone"
}
```

For a first-time Google user, the consent-aware response data is:

```json
{
  "status": "signup_required",
  "signupToken": "<short-lived-token>",
  "email": "ada@example.com",
  "fullName": "Ada Rossi",
  "photoUrl": "https://..."
}
```

Existing Google accounts (or a verified Google email linked to an existing eligible account) return an authenticated response directly. The user should review/edit the Google-provided `fullName` before submitting signup.

### 2.3 Create the account

`POST /auth/signup` — public, responds `201`.

Send `X-App-Contract: signup-consent`. The verified identifier is bound to the `signupToken`; do not send a phone number, email address, or Google subject in this request.

Phone signup:

```json
{
  "signupToken": "<signup-token-from-OTP-verify>",
  "fullName": "Ada Rossi",
  "consent": {
    "privacyAccepted": true,
    "privacyVersion": "2026-10-01T00:00:00.000Z"
  },
  "deviceType": "ios",
  "deviceName": "Ada's iPhone"
}
```

Email signup uses the same body plus a `password`:

```json
{
  "signupToken": "<signup-token-from-OTP-verify>",
  "fullName": "Ada Rossi",
  "password": "Example#482m",
  "consent": {
    "privacyAccepted": true,
    "privacyVersion": "2026-10-01T00:00:00.000Z"
  }
}
```

Google signup uses the Google `signupToken` and `consent`; `password` is not allowed.

Before submitting consent, fetch the current policy using `GET /content/policies/privacy`. Set `consent.privacyVersion` to its exact `data.updatedAt` value:

```json
{
  "success": true,
  "data": {
    "id": "privacy",
    "title": "Privacy Policy",
    "updatedAt": "2026-10-01T00:00:00.000Z",
    "sections": []
  },
  "message": "Privacy policy retrieved successfully."
}
```

Signup field rules:

| Field | Rule |
| --- | --- |
| `signupToken` | Required; use the token from the successful proof step. |
| `fullName` | Required; 2–80 characters with the consent contract header. |
| `password` | Required only for email signup; forbidden for phone and Google signup. |
| `password` strength | At least 8 characters, with a letter, number, and symbol; no adjacent repeated character and no 3-character alphabetic/numeric sequence. |
| `consent.privacyAccepted` | Must be `true` with the consent contract header. |
| `consent.privacyVersion` | Must exactly match the current privacy policy `updatedAt`. |

Successful signup returns:

```json
{
  "success": true,
  "data": {
    "status": "authenticated",
    "accessToken": "<access-token>",
    "refreshToken": "<refresh-token>",
    "expiresIn": 900,
    "user": {
      "id": "123",
      "firstName": "Ada",
      "lastName": "Rossi",
      "phone": "+14155550123",
      "phoneVerified": true,
      "email": null,
      "emailVerified": false,
      "displayName": "Ada Rossi",
      "photoUrl": null,
      "locale": "it",
      "roles": ["customer"],
      "googleLinked": false,
      "googleEmail": null,
      "hasPassword": false,
      "consent": {
        "privacyAcceptedAt": "2026-10-08T10:30:00.000Z",
        "privacyVersion": "2026-10-01T00:00:00.000Z",
        "current": true
      },
      "fitSetup": {
        "status": "pending",
        "selfProfileId": null,
        "capabilities": {
          "sizeAdviceReady": false,
          "virtualTryOnReady": false
        }
      }
    }
  },
  "message": "Account created successfully."
}
```

The IDs shown are examples. `accessToken` and `refreshToken` must be stored securely on the device. Send the access token as a Bearer token on protected requests. Store `expiresIn` as seconds.

### 2.4 Sign in and maintain the session

#### Email/password login

`POST /auth/login` — public, responds `200`.

```json
{
  "email": "ada@example.com",
  "password": "Example#482m",
  "deviceType": "ios",
  "deviceName": "Ada's iPhone"
}
```

Response data uses the same authenticated shape as successful signup: `status`, tokens, `expiresIn`, and `user`.

#### Refresh tokens

`POST /auth/refresh` — public, responds `200`. Flutter sends the refresh token in JSON:

```json
{
  "refreshToken": "<refresh-token>"
}
```

Response data is a refreshed authenticated result. Persist the returned tokens, replacing the prior values.

#### Logout

`POST /auth/logout` — Bearer access token required. It returns `204 No Content`; do not try to parse a JSON body.

`POST /auth/logout-all` — Bearer access token required. Revokes all sessions for the account and returns `204 No Content`.

### 2.5 Consent renewal

Use `GET /auth/me` on app launch/resume to retrieve the latest account, consent, and fit-setup state. If `data.consent` is `null` or `data.consent.current` is `false`, fetch the current policy and request acceptance.

`POST /auth/consent` — Bearer access token required, responds `200`.

```json
{
  "consent": {
    "privacyAccepted": true,
    "privacyVersion": "2026-10-01T00:00:00.000Z"
  }
}
```

Response data wraps the user under `data.user`:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "123",
      "consent": {
        "privacyAcceptedAt": "2026-10-08T11:00:00.000Z",
        "privacyVersion": "2026-10-01T00:00:00.000Z",
        "current": true
      },
      "fitSetup": {
        "status": "pending",
        "selfProfileId": null,
        "capabilities": {
          "sizeAdviceReady": false,
          "virtualTryOnReady": false
        }
      }
    }
  },
  "message": "Privacy consent recorded successfully."
}
```

The call is safe to retry. The backend does not accept client-provided acceptance timestamps.

## 3. Account profile endpoints

These endpoints edit the account's name/locale/profile picture. They are separate from body-profile measurements and body photos.

| Method | Path | Auth | Success |
| --- | --- | --- | --- |
| `GET` | `/auth/me` | Bearer | `200`, `data` is the current user object |
| `PATCH` | `/auth/me` | Bearer | `200`, updated user object |
| `PUT` | `/auth/me/photo` | Bearer | `200`, updated user object |
| `DELETE` | `/auth/me/photo` | Bearer | `200`, updated user object |

`PATCH /auth/me` accepts one or more fields:

```json
{
  "firstName": "Ada",
  "lastName": "Rossi",
  "locale": "it"
}
```

`firstName` is a non-empty string up to 100 characters; `lastName` may be `null`; `locale` is `it` or `en`. Unknown keys and an empty update are rejected.

`PUT /auth/me/photo` is multipart form data with an `image` file part. JPEG, PNG, and WebP are supported; the backend applies configured image limits and normalization. The response is the updated account user object, including `photoUrl`. Use this endpoint only for the account avatar; use `POST /media` for body-profile photos.

## 4. Body-profile and fit-setup flow

### Recommended first-profile sequence

1. After account signup, use `GET /auth/me` or `GET /body-profiles` to confirm current state. Signup does not create a body profile.
2. Save the user's own profile with `PUT /body-profiles/self`.
3. Optionally try `POST /fit/measurements/estimate`; see section 5 for its current availability.
4. Save manually entered or estimated measurements with `PATCH /body-profiles/:id`.
5. Optionally upload body-profile photos to `POST /media`, then attach their returned URLs with `PATCH /body-profiles/:id`.
6. If the user skips setup, call `POST /shopper/fit-setup/skip`.

All body-profile routes require a Bearer access token.

### `PUT /body-profiles/self` — create or update the signed-in user's profile

This is the recommended idempotent endpoint for fit setup. It creates the self profile if one does not exist and updates it if it already exists. Responds `200`.

```json
{
  "name": "Ada Rossi",
  "sex": "female",
  "measurements": {
    "heightCm": 170,
    "weightKg": 62
  }
}
```

`relation` is set to `self` by the route. `name` is required (2–40 characters), as is the `measurements` object containing both `heightCm` and `weightKg`.

### `POST /body-profiles` — create a profile

Responds `201`. Use for creating a profile with an explicit relation, including a self profile if using create-only behavior:

```json
{
  "name": "Ada Rossi",
  "relation": "self",
  "sex": "female",
  "measurements": {
    "heightCm": 170,
    "weightKg": 62
  }
}
```

Allowed `relation` values: `self`, `partner`, `child`, `other`. The first profile on an account must be `self`; only one self profile is allowed. Repeating a `POST` for self returns `409` with reason `self_exists`; `PUT /body-profiles/self` is preferable for retries.

### Profile object

Successful create/read/update responses return one profile in `data`:

```json
{
  "success": true,
  "data": {
    "id": "123",
    "name": "Ada Rossi",
    "relation": "self",
    "isDefault": true,
    "sex": "female",
    "avatarUrl": null,
    "photos": {
      "front": null,
      "back": null,
      "left": null,
      "right": null
    },
    "measurements": {
      "heightCm": 170,
      "weightKg": 62,
      "shouldersCm": null,
      "chestCm": null,
      "waistCm": null,
      "hipsCm": null,
      "inseamCm": null,
      "armLengthCm": null,
      "shoeEu": null,
      "footLengthCm": null
    },
    "stylist": null,
    "updatedAt": "2026-10-08T10:31:00.000Z"
  },
  "message": "Body profile retrieved successfully."
}
```

The numeric-looking profile `id` is serialized as a string. Store and pass it as a string in the path.

Measurement constraints enforced by the backend:

| Field(s) | Supported range |
| --- | --- |
| `heightCm` | 80–250 |
| `weightKg` | 20–300 |
| `shouldersCm`, `chestCm`, `waistCm`, `hipsCm`, `inseamCm`, `armLengthCm`, `footLengthCm` | 1–300 |
| `shoeEu` | 15–60 |
| `sex` | `male`, `female`, or `null` |

Measurements accept finite numbers or `null`. Decimal precision is not enforced by request validation; persisted decimal fields are one decimal place.

### Read and update body profiles

| Method | Path | Purpose | Success |
| --- | --- | --- | --- |
| `GET` | `/body-profiles` | List this account's profiles | `200` |
| `GET` | `/body-profiles/:id` | Read one owned profile | `200` |
| `PATCH` | `/body-profiles/:id` | Partially update an owned profile | `200` |
| `DELETE` | `/body-profiles/:id` | Delete an eligible profile | `200`, `data: null` |

List query parameters:

```text
GET /body-profiles?limit=20&cursor=<nextCursor>
```

`limit` defaults to `20` and must be `1`–`50`; `cursor` is omitted on the first request. The response has `data` as an array and pagination beside it:

```json
{
  "success": true,
  "data": [],
  "page": {
    "limit": 20,
    "nextCursor": null,
    "hasMore": false,
    "total": 0
  },
  "message": "Body profiles retrieved successfully."
}
```

`PATCH /body-profiles/:id` takes only fields to change. For example, save measurements:

```json
{
  "measurements": {
    "shouldersCm": 41,
    "chestCm": 92,
    "waistCm": 74,
    "hipsCm": 98,
    "inseamCm": 78,
    "armLengthCm": 58,
    "shoeEu": 38,
    "footLengthCm": 24.5
  }
}
```

Or update identity/fit fields:

```json
{
  "name": "Ada Rossi",
  "sex": "female",
  "measurements": {
    "heightCm": 171,
    "weightKg": 63
  }
}
```

Omitted fields remain unchanged. A measurement set to `null` is cleared. A non-self profile can change its `relation` among `partner`, `child`, and `other` by including the new relation in this PATCH. The self profile cannot be changed to a family relation, and a family profile cannot be changed to `self`; these requests return `422` with `details.fields.relation: "immutable"`. The body must contain at least one supported field; unknown keys are rejected.

Deleting `photos.<angle>` is done by setting that angle to `null` in the `photos` object.

### `DELETE /body-profiles/:id` — delete a family profile

The signed-in shopper can delete an owned `partner`, `child`, or `other` profile. The `self` profile cannot be deleted, and at least one profile must remain on the account. Attached body photos are removed with the deleted profile. If the deleted profile was the default, the backend promotes another profile (preferring `self`).

No request body is required:

```http
DELETE /api/v1/body-profiles/15
Authorization: Bearer <access-token>
```

Success (`200`):

```json
{
  "success": true,
  "data": null,
  "message": "Body profile deleted successfully."
}
```

The endpoint returns `404` if the profile does not exist or is not owned by the current account. It returns `422` with `details.reason: "self_required"` when attempting to delete a self profile while another profile exists, or `details.reason: "last_profile"` when attempting to delete the account's only profile.

## 5. Body-profile photos and measurement estimation

### Upload and attach a stored body photo

`POST /media` — Bearer access token required; multipart form data; responds `201`.

Form fields:

| Field | Value |
| --- | --- |
| `purpose` | `bodyPhoto` |
| `file` | One JPEG, PNG, or WebP image; maximum 8 MB |

Example successful response:

```json
{
  "success": true,
  "data": {
    "id": "456",
    "url": "https://redressbackend.cyberimpulses.com/api/v1/media/<media-token>",
    "purpose": "bodyPhoto",
    "mimeType": "image/webp",
    "width": 1024,
    "height": 1536,
    "bytes": 123456
  },
  "message": "Body photo uploaded successfully."
}
```

Use the returned `url` when attaching the image. Uploads are private and belong to the authenticated user. The URL is an expiring media URL (at most 15 minutes); body-profile read/update responses generate fresh URLs for attached photos.

Attach a URL (one or more angles) with `PATCH /body-profiles/:id`:

```json
{
  "photos": {
    "front": "https://redressbackend.cyberimpulses.com/api/v1/media/<media-token>",
    "left": "https://redressbackend.cyberimpulses.com/api/v1/media/<another-media-token>"
  }
}
```

Available angles: `front`, `back`, `left`, `right`. The URL must have been returned by an upload for the same account. A URL from another account is rejected. To remove an attached photo, send its angle with `null`; the detached media is deleted after the database update. Unattached uploads are cleaned up after 24 hours.

### Optional: estimate measurements from two photos

`POST /fit/measurements/estimate` — Bearer access token required; `multipart/form-data`.

| Part | Required | Value |
| --- | --- | --- |
| `front` | Yes | Front full-body photo, JPEG/PNG/WebP, max 8 MB |
| `side` | Yes | Side full-body photo, JPEG/PNG/WebP, max 8 MB |
| `sex` | Yes | `male` or `female` |
| `heightCm` | Yes | Number, 80–250 |
| `weightKg` | Yes | Number, 20–300 |

Each photo is processed in memory and the request rejects more than 16 MB total. The endpoint does not store or attach the images.

**Current backend availability:** valid requests currently return `503 SERVICE_UNAVAILABLE` with `details.reason: "estimator_unavailable"`. The backend has no working estimator response yet. Flutter must handle this response and let the user enter measurements manually; do not block the rest of profile setup.

Current response:

```json
{
  "success": false,
  "data": null,
  "message": "An unexpected error occurred. Please try again later.",
  "errorCode": "SERVICE_UNAVAILABLE",
  "messageKey": "errorServiceUnavailable",
  "details": {
    "retryable": true,
    "reason": "estimator_unavailable"
  }
}
```

There is also `POST /body-profiles/:id/estimate` for estimating from photos already attached to a profile. It currently returns the same `503` when the profile has a body photo; without one it returns `422`.

### Skip fit setup

`POST /shopper/fit-setup/skip` — Bearer access token required; no request body is needed; responds `200`.

```json
{
  "success": true,
  "data": {
    "status": "skipped",
    "selfProfileId": null,
    "capabilities": {
      "sizeAdviceReady": false,
      "virtualTryOnReady": false
    }
  },
  "message": "Fit setup was skipped successfully."
}
```

The operation is safe to retry. Any saved profile remains. `selfProfileId` may be non-null if the user already started the profile.

### Fit-setup status

The account user object returned by auth endpoints contains `fitSetup`:

```json
{
  "status": "partial",
  "selfProfileId": "123",
  "capabilities": {
    "sizeAdviceReady": true,
    "virtualTryOnReady": false
  }
}
```

| Status | Meaning |
| --- | --- |
| `pending` | No self profile; setup has not been skipped. |
| `partial` | A self profile exists but setup is incomplete. |
| `ready` | Self profile has height and weight and at least one attached body photo. |
| `skipped` | User skipped while the profile is not ready. |

When a self profile is saved or updated, the skipped marker is cleared. `sizeAdviceReady` is based on height and weight; `virtualTryOnReady` is based on at least one attached profile photo.

## 6. Other auth endpoints

All paths below are relative to the base URL above.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/auth/forgot-password` | Public | Request password-reset OTP by email |
| `POST` | `/auth/forgot-password/verify` | Public | Verify reset OTP and receive reset token |
| `POST` | `/auth/reset-password` | Public | Set a new password with reset token |
| `POST` | `/auth/change-password` | Bearer | Change an existing password |
| `POST` | `/auth/set-password` | Bearer + recent authentication | Set the first password, e.g. for Google-only account |
| `POST` | `/auth/phone/verify` | Bearer | Verify an account phone |
| `POST` | `/auth/phone/change/request` | Bearer + recent authentication | Request OTP for a new phone |
| `POST` | `/auth/phone/change/verify` | Bearer | Verify and change phone |
| `POST` | `/auth/email/change/request` | Bearer + recent authentication | Request OTP for a new email |
| `POST` | `/auth/email/change/verify` | Bearer | Verify and change email |

Password reset sequence:

1. `POST /auth/forgot-password` with `{"email":"ada@example.com"}`.
2. `POST /auth/forgot-password/verify` with `{"email":"ada@example.com","otp":"123456"}`; use the returned reset token.
3. `POST /auth/reset-password` with `{"resetToken":"<reset-token>","newPassword":"Example#482m"}`.

`change-password` expects `currentPassword` and `newPassword`; `set-password` expects `newPassword`. Both use the same password-strength rules described in section 2.3.

These routes' current success response bodies are legacy `{ "data": ... }` responses (no `success` or `message` field):

```json
{ "data": { "status": "accepted", "expiresIn": 300, "resendIn": 60 } }
```

```json
{ "data": { "status": "verified", "resetToken": "<reset-token>", "expiresIn": 600 } }
```

```json
{ "data": { "status": "password_reset" } }
```

`change-password` returns `{"data":{"status":"password_changed"}}`; `set-password` returns `{"data":{"status":"password_set"}}`. Durations are examples; the server configuration is authoritative.

Contact change request bodies:

```json
{ "newPhone": "+14155550123" }
```

```json
{ "newEmail": "new@example.com" }
```

Verification bodies add `otp`, e.g. `{"newPhone":"+14155550123","otp":"123456"}` or `{"newEmail":"new@example.com","otp":"123456"}`. To request a phone-link OTP, use `POST /auth/otp/send` with `{"purpose":"phone_link","channel":"sms","phone":"+14155550123"}` and an authenticated, recently authenticated session.

## 7. Error handling and Flutter implementation notes

| HTTP | Typical meaning | Flutter action |
| --- | --- | --- |
| `400` | Invalid JSON/request fields | Show validation feedback; check field names and request format. |
| `401` | Missing, expired, or closed session/token | Refresh once if appropriate; otherwise clear credentials and send user to sign-in. |
| `403` | Account/action is not permitted | Show a user-friendly access message. |
| `404` | Profile does not exist or is not owned by this account | Refresh profile state; do not expose another user's data. |
| `409` | Duplicate account/profile conflict | Use the existing profile or show a conflict message. |
| `413` | Upload too large | Ask user to choose a smaller image. |
| `422` | Invalid OTP, stale consent, measurement range, or invalid profile/media data | Use `details.fields` / `details.reason` when present; otherwise show `message`. |
| `429` | Rate limited | Respect `retryable` and any server-provided wait information; do not loop retries. |
| `503` | Temporary dependency/estimator unavailable | Offer retry or manual measurement entry. |

Important implementation details:

- Treat `signupToken` and auth tokens as credentials; never log them.
- Do not create a body profile as part of account signup. Start it after account creation.
- Prefer `PUT /body-profiles/self` for a retry-safe self-profile save.
- Keep the returned profile photo URL for each angle and send it back to PATCH; do not upload body photos as account avatars.
- Refresh `GET /auth/me` after profile changes if the app needs the account-level `fitSetup` state.
- Use server response status and payload as authoritative; do not infer signup success from an OTP verification alone.
- For `204` logout, an empty response body is expected.
