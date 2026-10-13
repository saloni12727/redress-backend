# Account, Support & Content API — backend handoff v1.0

What the shopper app needs for: **returns** (list, detail, request), **order
tracking**, **AI preferences**, **plans / credits / subscriptions**, **help &
support** (FAQ + full message support), **notifications** (inbox, badge,
settings, push devices), and **policies** (privacy, terms, shipping).

Base URL: `https://redressbackend.cyberimpulses.com/api/v1`

Every screen listed here already exists in the app and runs on local demo data
today. As soon as an endpoint below is live, the app switches that screen to it.

---

## 0. What exists today (checked 13 Oct 2026)

| Area | Endpoint | Live today | This doc |
|---|---|---|---|
| Returns | `POST /returns` | Yes | Unchanged, plus 2 small fixes on order detail |
| Returns | `GET /returns`, `GET /returns/{id}` | **No** (not mounted for shoppers) | §2 |
| Returns | `POST /returns/{id}/cancel` | No | §2 |
| Tracking | `GET /orders/{id}/tracking` | **No** | §3 |
| AI preferences | `GET/PUT/DELETE /me/ai-preferences` | No | §4 |
| Plans & credits | `/billing/*`, `/me/credits`, `/me/subscription` | No | §5 |
| Help | `GET /support/config`, `GET /support/faqs` | No | §6 |
| Message support | `/support/tickets/*` | No | §7 |
| Policies | `GET /content/policies/privacy` | **Yes** | Keep as-is |
| Policies | `terms`, `shipping`, `returns`, `cookies`, index | No (404) | §8 |
| Notifications | `/notifications/*`, `/me/notification-settings`, `/me/devices` | No (404) | §9 |

Build order suggestion: §8 policies (quick) → §9 notifications (devices +
inbox) → §3 tracking → §2 returns read → §7 support → §6 FAQ → §4 AI
preferences → §5 credits.

---

## 1. Shared rules (same as the live Commerce / Wishlist routes)

### 1.1 Headers

```http
Authorization: Bearer <accessToken>     # every route marked JWT
Accept: application/json
Content-Type: application/json
Accept-Language: it | en                # ?lang=it|en overrides it
```

### 1.2 Success

One object:

```json
{ "success": true, "data": { }, "message": "Return retrieved successfully." }
```

A list (page numbers, same as `GET /orders` and `GET /wishlist`):

```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": { "page": 1, "limit": 20, "total": 0, "totalPages": 0 }
  },
  "message": "Returns retrieved successfully."
}
```

| Query | Default | Rule |
|---|---|---|
| `page` | 1 | Starts at 1 |
| `limit` | 20 | Maximum 50 |

Empty lists are `[]`, never `null`. The newest items come first unless the
endpoint says otherwise.

### 1.3 Errors

```json
{
  "success": false,
  "data": null,
  "message": "The 14-day return window for this order has expired.",
  "errorCode": "RETURN_WINDOW_EXPIRED",
  "details": { "fields": { "items[0].quantity": "max" } }
}
```

The app shows `message` to the shopper, so write it as a sentence a shopper
can read, in the request language. `errorCode` and `details` are optional but
strongly wanted: the app uses them to highlight a field or pick a screen.

| HTTP | When | App behaviour |
|---|---|---|
| 400 | Wrong body or query shape | Developer bug, no retry |
| 401 | No session / expired session | Refresh token, then login |
| 402 | Not enough AI credits (§5) | Opens Plans |
| 403 | Signed in, but not allowed (for example a seller-only desk) | Shows message |
| 404 | Missing, **or belongs to another user** | "Not found" state |
| 409 | State conflict (return already cancelled, ticket closed) | Refreshes the screen |
| 422 | Business rule failed (window expired, qty too high) | Shows message, keeps form |
| 429 | Rate limited | Shows message, retry later |
| 5xx | Server error | Retry button |

### 1.4 Values

| Type | Format |
|---|---|
| Ids | Numeric strings: `"31"` (the app also accepts numbers) |
| Money | JSON number in EUR with 2 decimals, `47.94`, plus `currency: "EUR"` |
| Dates | ISO 8601 UTC: `"2026-10-12T11:10:00.000Z"` |
| Codes | Stable English camelCase codes (`sizeFit`, `outForDelivery`). The app translates codes it knows; for anything else it shows `label`. |
| Labels | Every `label` / `title` / `description` written by the system is translated by `Accept-Language` |
| Images | HTTPS URLs (the signed `/media/...` URLs are fine) |

### 1.5 Idempotency (all `POST` that create something)

The app sends `Idempotency-Key: <uuid>` on `POST /returns`,
`POST /support/tickets`, `POST /support/tickets/{id}/messages` and
`POST /billing/purchases`. If the same key arrives again within 24 h, return
the first result (same status code and body) instead of creating a duplicate.
This protects against double-taps and retries on bad networks.

---

## 2. Returns

### 2.1 Return status codes

Uses the values already in the return model, plus `cancelled`:

| `status` | Meaning | Shown in app as |
|---|---|---|
| `requested` | Created, waiting for review | Requested |
| `approved` | Approved; label / instructions available | Approved / Label ready |
| `inTransit` | Parcel on its way back | In transit |
| `refundPending` | Parcel received and checked, refund being processed | Received |
| `refunded` | Refund done | Refunded |
| `rejected` | Refused (see `rejectionReason`) | Rejected |
| `cancelled` | **NEW**: shopper cancelled before approval | Cancelled |

| `refundStatus` | Meaning |
|---|---|
| `not_started` | Nothing refunded yet (always right after `POST /returns`) |
| `pending` | Refund started |
| `manual` | Refund recorded manually (cash / bank) |
| `refunded` | Refund completed |

Return `reason` codes (unchanged): `sizeFit`, `quality`, `notAsDescribed`,
`changedMind`, `damaged`, `other`. A non-empty `note` is required for `other`
(max 1000 chars).

### 2.2 Two fixes on `GET /orders/{id}` (blockers for the return form)

The return form cannot submit without these.

```json
"lines": [
  {
    "orderItemId": "17",
    "productId": "1",
    "slug": "floral-midi-dress",
    "title": "Floral Midi Dress",
    "colorId": "black",
    "size": "M",
    "qty": 2,
    "returnableQty": 1,
    "unitPrice": 47.94,
    "lineTotal": 95.88,
    "imageUrl": "https://..."
  }
],
"returnDeadlineAt": "2026-10-20T10:00:00.000Z",
"actions": { "canCancel": false, "canTrack": true, "canReturn": true }
```

| Field | Rule |
|---|---|
| `lines[].orderItemId` | **Required.** The id `POST /returns` expects |
| `lines[].returnableQty` | **NEW.** `qty` minus units already in a non-cancelled, non-rejected return. `0` = cannot be picked |
| `returnDeadlineAt` | **NEW.** `deliveredAt + 14 days`; `null` before delivery |
| `actions.canReturn` | `true` only if `status = delivered`, **now < returnDeadlineAt**, and some line has `returnableQty > 0` |

Also: return the real product **title** on lines (today it is the SKU, for
example `RD-W-DRESS-001`).

Optional, for the "Pick an order" step: `GET /orders?returnable=true` returns
only orders where `actions.canReturn = true`.

### 2.3 `POST /returns` (live, unchanged)

Auth: JWT. Header `Idempotency-Key` (see 1.5).

```json
{
  "orderId": 4,
  "items": [
    { "orderItemId": 17, "quantity": 1, "reason": "sizeFit", "note": "Too small" }
  ]
}
```

Response `201` is the **return detail object** (§2.5). Today's response
already matches its first fields, so only the extra fields need to be added.

| Error | HTTP | `errorCode` |
|---|---|---|
| Order not delivered | 422 | `ORDER_NOT_DELIVERED` |
| Past 14 days | 422 | `RETURN_WINDOW_EXPIRED` |
| Quantity above `returnableQty` | 422 | `RETURN_QTY_EXCEEDED` |
| Missing note for `other`, unknown reason, duplicate line | 422 | `VALIDATION` with `details.fields` |
| Order of another user | 404 | `NOT_FOUND` |

### 2.4 `GET /returns`: return history

Auth: JWT.

| Query | Type | Note |
|---|---|---|
| `page`, `limit` | int | See 1.2 |
| `status` | csv | Optional, for example `requested,approved` |
| `orderId` | string | Optional: returns of one order (used on order detail) |

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "31",
        "returnNumber": "RT-000031",
        "orderId": "4",
        "orderNumber": "RG-1791792000000-AB12",
        "status": "approved",
        "statusLabel": "Approvato",
        "refundStatus": "not_started",
        "refundAmount": 47.94,
        "currency": "EUR",
        "itemCount": 1,
        "previewImageUrl": "https://...",
        "requestedAt": "2026-10-12T11:10:00.000Z",
        "updatedAt": "2026-10-12T15:00:00.000Z"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
  },
  "message": "Returns retrieved successfully."
}
```

### 2.5 `GET /returns/{id}`: return detail

Auth: JWT. Another user's return is `404`.

```json
{
  "success": true,
  "data": {
    "id": "31",
    "returnNumber": "RT-000031",
    "orderId": "4",
    "orderNumber": "RG-1791792000000-AB12",
    "status": "approved",
    "statusLabel": "Approvato",
    "requestedAt": "2026-10-12T11:10:00.000Z",
    "updatedAt": "2026-10-12T15:00:00.000Z",
    "returnDeadlineAt": "2026-10-20T10:00:00.000Z",
    "rejectionReason": null,

    "items": [
      {
        "orderItemId": "17",
        "product": {
          "productId": "1",
          "slug": "floral-midi-dress",
          "title": "Floral Midi Dress",
          "brand": "Velora",
          "colorId": "black",
          "size": "M",
          "imageUrl": "https://..."
        },
        "quantity": 1,
        "reason": "sizeFit",
        "note": "Too small",
        "unitPrice": 47.94,
        "lineTotal": 47.94
      }
    ],

    "refund": {
      "status": "not_started",
      "amount": 47.94,
      "currency": "EUR",
      "method": "original",
      "refundedAt": null
    },

    "shipment": {
      "rmaCode": "RMA-IT-000031",
      "carrier": { "code": "ups", "name": "UPS" },
      "trackingNumber": null,
      "trackingUrl": null,
      "labelUrl": "https://.../label.pdf",
      "qrCodeUrl": "https://.../qr.png",
      "dropOffInstructions": "Any UPS Access Point. Keep the QR code ready.",
      "shipBy": "2026-10-19T22:00:00.000Z"
    },

    "timeline": [
      { "status": "requested",     "label": "Richiesta inviata", "description": "Abbiamo ricevuto la tua richiesta.", "at": "2026-10-12T11:10:00.000Z", "done": true },
      { "status": "approved",      "label": "Approvato",         "description": "Stampa l'etichetta o mostra il QR.",  "at": "2026-10-12T15:00:00.000Z", "done": true },
      { "status": "inTransit",     "label": "In viaggio",        "description": null, "at": null, "done": false },
      { "status": "refundPending", "label": "Ricevuto",          "description": null, "at": null, "done": false },
      { "status": "refunded",      "label": "Rimborsato",        "description": null, "at": null, "done": false }
    ],

    "actions": { "canCancel": false }
  },
  "message": "Return retrieved successfully."
}
```

| Field | Rule |
|---|---|
| `refund.method` | `original` (same payment), `wallet`, `cash`, `bank` |
| `refund.amount` | Expected refund; may change after inspection |
| `shipment` | `null` until `approved`. `labelUrl` / `qrCodeUrl` may be `null` if not used |
| `timeline` | Always the **full** expected path; future steps have `done: false`, `at: null`. For `rejected` / `cancelled`, end the list with that step |
| `actions.canCancel` | `true` only while `status = requested` |

### 2.6 `POST /returns/{id}/cancel`

Auth: JWT. No body. Allowed only while `requested`.

Response `200`: the return detail with `status: "cancelled"`. Units go back
to `returnableQty`. Any other status is `409` `RETURN_NOT_CANCELLABLE`.

---

## 3. Order tracking

### 3.1 `GET /orders/{id}/tracking`

Auth: JWT. Allowed when `actions.canTrack = true`, but **never 404 just
because it has not shipped**: return the order timeline so far, with
`shipments: []`.

The marketplace can split one order into several parcels (one per seller), so
tracking is a list of shipments.

```json
{
  "success": true,
  "data": {
    "orderId": "4",
    "orderNumber": "RG-1791792000000-AB12",
    "status": "shipped",
    "statusLabel": "Spedito",
    "estimatedDelivery": { "from": "2026-10-14T00:00:00.000Z", "to": "2026-10-15T00:00:00.000Z" },
    "deliveredAt": null,
    "address": { "fullName": "Ada Rossi", "city": "Milano", "postalCode": "20121", "country": "IT" },

    "timeline": [
      { "code": "placed",    "label": "Ordine effettuato", "at": "2026-10-12T10:00:00.000Z", "done": true },
      { "code": "confirmed", "label": "Confermato",        "at": "2026-10-12T10:05:00.000Z", "done": true },
      { "code": "packed",    "label": "Imballato",         "at": "2026-10-12T16:00:00.000Z", "done": true },
      { "code": "shipped",   "label": "Spedito",           "at": "2026-10-13T08:00:00.000Z", "done": true },
      { "code": "outForDelivery", "label": "In consegna",  "at": null, "done": false },
      { "code": "delivered", "label": "Consegnato",        "at": null, "done": false }
    ],

    "shipments": [
      {
        "id": "9",
        "orderItemIds": ["17", "18"],
        "carrier": { "code": "brt", "name": "BRT", "phone": "+390000000000" },
        "trackingNumber": "BRT123456789",
        "trackingUrl": "https://vas.brt.it/vas/sped_det_show.hsm?referer=...",
        "status": "inTransit",
        "statusLabel": "In transito",
        "shippedAt": "2026-10-13T08:00:00.000Z",
        "estimatedDelivery": { "from": "2026-10-14T00:00:00.000Z", "to": "2026-10-15T00:00:00.000Z" },
        "events": [
          {
            "code": "inTransit",
            "label": "In transito",
            "description": "Il pacco ha lasciato l'hub di Bologna.",
            "location": "Bologna, IT",
            "at": "2026-10-13T19:20:00.000Z"
          },
          {
            "code": "pickedUp",
            "label": "Ritirato dal corriere",
            "description": null,
            "location": "Milano, IT",
            "at": "2026-10-13T08:00:00.000Z"
          }
        ]
      }
    ]
  },
  "message": "Tracking retrieved successfully."
}
```

| Field | Rule |
|---|---|
| `timeline` | Order-level steps, full path, same pattern as returns (`done`, `at: null` for future). Ends with `cancelled` if cancelled |
| `timeline[].code` | `placed`, `confirmed`, `packed`, `shipped`, `outForDelivery`, `delivered`, `cancelled`, `deliveryFailed`, `returnedToSender` |
| `shipments[].events` | Carrier scans, **newest first**. `description` / `location` may be `null` |
| `shipments[].events[].code` | `labelCreated`, `pickedUp`, `inTransit`, `atHub`, `outForDelivery`, `deliveryAttempted`, `delivered`, `exception`, `returnedToSender` |
| `trackingUrl` | Carrier web page; the app opens it in the browser |
| `estimatedDelivery` | `null` if unknown. A single day sends `from = to` |

Cache: the app polls this at most every 60 s while the screen is open. Carrier
data can be cached server-side for 10–15 minutes.

### 3.2 Summary on the order (optional, saves a call)

Add to `GET /orders/{id}`:

```json
"tracking": {
  "carrierName": "BRT",
  "trackingNumber": "BRT123456789",
  "trackingUrl": "https://...",
  "estimatedDelivery": { "from": "2026-10-14T00:00:00.000Z", "to": "2026-10-15T00:00:00.000Z" }
}
```

`null` before shipping.

### 3.3 Push

On each order status change, create an inbox notification and send a push
(§9). Types: `order.confirmed`, `order.shipped`, `order.outForDelivery`,
`order.delivered`, `order.cancelled`, `order.deliveryFailed`. A tap opens
`/delivery/{orderId}`.

---

## 4. AI preferences (style taste)

What the shopper picks on **Profile → AI preferences**. Stylist, AI picks on
Home, and Try-On suggestions use it. Today it is saved only on the phone.

### 4.1 `GET /ai-preferences/options`

Public. The option lists and their translated labels, so new options can be
added without an app release.

```json
{
  "success": true,
  "data": {
    "groups": [
      {
        "code": "shopFor", "label": "Compro per", "multi": true, "max": 4,
        "options": [
          { "code": "women", "label": "Donna" },
          { "code": "men", "label": "Uomo" },
          { "code": "kids", "label": "Bambini" },
          { "code": "unisex", "label": "Unisex" }
        ]
      },
      { "code": "styles",    "label": "Stili",     "multi": true,  "max": 8, "options": [ { "code": "casual", "label": "Casual" } ] },
      { "code": "occasions", "label": "Occasioni", "multi": true,  "max": 6, "options": [ { "code": "work", "label": "Lavoro" } ] },
      { "code": "colors",    "label": "Colori",    "multi": true,  "max": 8, "options": [ { "code": "black", "label": "Nero", "hex": "#000000" } ] },
      { "code": "fit",       "label": "Vestibilità","multi": false, "max": 1, "options": [ { "code": "regular", "label": "Regolare" } ] },
      { "code": "goals",     "label": "Obiettivi", "multi": true,  "max": 5, "options": [ { "code": "essentials", "label": "Essenziali" } ] }
    ]
  },
  "message": "Options retrieved successfully."
}
```

The codes the app uses today (please seed exactly these):

| Group | Codes |
|---|---|
| `shopFor` | `women`, `men`, `kids`, `unisex` |
| `styles` | `casual`, `street`, `minimal`, `formal`, `sporty`, `elegant`, `boho`, `vintage` |
| `occasions` | `work`, `weekend`, `party`, `travel`, `gym`, `date` |
| `colors` | `black`, `white`, `navy`, `beige`, `grey`, `earth`, `bright`, `pastel` |
| `fit` | `slim`, `regular`, `relaxed`, `oversized` (single choice) |
| `goals` | `trends`, `essentials`, `sustainable`, `value`, `premium` |

### 4.2 `GET /me/ai-preferences`

Auth: JWT. A user who never saved gets empty lists, **not 404**.

```json
{
  "success": true,
  "data": {
    "shopFor": ["women"],
    "styles": ["minimal", "elegant"],
    "occasions": ["work"],
    "colors": ["black", "beige"],
    "fit": "regular",
    "goals": ["essentials", "sustainable"],
    "selectedCount": 8,
    "updatedAt": "2026-10-12T09:30:00.000Z"
  },
  "message": "AI preferences retrieved successfully."
}
```

### 4.3 `PUT /me/ai-preferences`: save (full replace)

Auth: JWT. The app sends the **whole** object each time (debounced ~800 ms
after the last chip tap).

```json
{
  "shopFor": ["women"],
  "styles": ["minimal", "elegant"],
  "occasions": ["work"],
  "colors": ["black", "beige"],
  "fit": "regular",
  "goals": ["essentials", "sustainable"]
}
```

| Rule | Value |
|---|---|
| Missing group | Treated as empty (`[]`, `fit: null`) |
| Unknown code | `422` `VALIDATION`, `details.fields.styles = "unknown:xyz"` |
| Too many | `422` `VALIDATION`, `details.fields.styles = "max"` |
| Duplicates | Removed silently |

Response `200`: same body as `GET`, with the new `updatedAt`.

### 4.4 `DELETE /me/ai-preferences`: reset

Auth: JWT. Response `200` with the empty object (same shape as `GET`).

### 4.5 Guest → account

Guests keep preferences on the phone. On sign-in the app calls `GET`. If the
server copy is empty and the phone copy is not, the app sends `PUT` with the
phone copy; otherwise the server copy wins. No extra endpoint is needed.

---

## 5. Plans, credits & subscriptions

Credits pay for AI work (Try-On: **1 credit per camera angle**). Today the
balance, plans and top-ups are demo-only on the phone.

> **Store rule:** credits and subscriptions are digital goods, so on iOS and
> Android they **must** be bought through Apple In-App Purchase / Google Play
> Billing. The app buys through the store and sends the receipt to the backend
> (§5.5). The backend verifies it, grants credits, and keeps the subscription
> state from Apple / Google server notifications.

### 5.1 `GET /billing/plans`

Public (the app shows prices before login).

```json
{
  "success": true,
  "data": {
    "currency": "EUR",
    "plans": [
      {
        "code": "base",
        "name": "Base",
        "description": "Per provare look ogni settimana.",
        "price": 9.90,
        "interval": "month",
        "creditsPerPeriod": 30,
        "recommended": false,
        "features": ["30 crediti al mese", "Try-On fino a 4 angolazioni"],
        "store": { "appleProductId": "rg.plan.base.monthly", "googleProductId": "rg_plan_base_monthly" }
      },
      {
        "code": "plus", "name": "Plus", "description": "Il più scelto.",
        "price": 19.90, "interval": "month", "creditsPerPeriod": 90, "recommended": true,
        "features": ["90 crediti al mese", "Stylist AI illimitato"],
        "store": { "appleProductId": "rg.plan.plus.monthly", "googleProductId": "rg_plan_plus_monthly" }
      },
      {
        "code": "pro", "name": "Pro", "description": "Per chi crea look ogni giorno.",
        "price": 39.90, "interval": "month", "creditsPerPeriod": 220, "recommended": false,
        "features": ["220 crediti al mese", "Priorità di generazione"],
        "store": { "appleProductId": "rg.plan.pro.monthly", "googleProductId": "rg_plan_pro_monthly" }
      }
    ],
    "packs": [
      {
        "code": "pack20", "name": "20 crediti", "credits": 20, "price": 4.90,
        "store": { "appleProductId": "rg.credits.20", "googleProductId": "rg_credits_20" }
      }
    ],
    "creditCosts": [
      { "action": "tryOnAngle", "label": "Try-On, per angolazione", "credits": 1 }
    ]
  },
  "message": "Plans retrieved successfully."
}
```

`price` is the reference price. On phones the app shows the **store's**
localized price when it has one (Apple / Google decide the final price).

### 5.2 `GET /me/credits`

Auth: JWT.

```json
{
  "success": true,
  "data": {
    "balance": 86,
    "expiring": { "credits": 30, "at": "2026-11-12T00:00:00.000Z" },
    "subscription": {
      "status": "active",
      "planCode": "plus",
      "planName": "Plus",
      "renewsAt": "2026-11-12T00:00:00.000Z"
    }
  },
  "message": "Credits retrieved successfully."
}
```

`expiring` is `null` if nothing expires. `subscription` is `null` without a
plan.

### 5.3 `GET /me/credits/transactions`: credit history

Auth: JWT. Query `page`, `limit`, `type` (csv, optional).

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "501",
        "type": "spend",
        "amount": -4,
        "balanceAfter": 86,
        "description": "Try-On, 4 angolazioni",
        "reference": { "type": "tryOnJob", "id": "job_77" },
        "createdAt": "2026-10-12T12:00:00.000Z"
      },
      {
        "id": "500",
        "type": "subscription",
        "amount": 90,
        "balanceAfter": 90,
        "description": "Piano Plus, ottobre",
        "reference": { "type": "subscription", "id": "12" },
        "createdAt": "2026-10-12T00:00:00.000Z"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 2, "totalPages": 1 }
  },
  "message": "Credit history retrieved successfully."
}
```

`type`: `welcome`, `subscription`, `purchase`, `spend`, `refund`, `expire`,
`adjust`. `amount` is positive for credits in and negative for credits out.

### 5.4 `GET /me/subscription`

Auth: JWT.

```json
{
  "success": true,
  "data": {
    "status": "active",
    "plan": { "code": "plus", "name": "Plus", "price": 19.90, "interval": "month", "creditsPerPeriod": 90 },
    "platform": "apple",
    "currentPeriodStart": "2026-10-12T00:00:00.000Z",
    "currentPeriodEnd": "2026-11-12T00:00:00.000Z",
    "autoRenew": true,
    "cancelAtPeriodEnd": false,
    "manageUrl": "https://apps.apple.com/account/subscriptions"
  },
  "message": "Subscription retrieved successfully."
}
```

`status`: `none`, `active`, `trialing`, `inGrace`, `pastDue`, `cancelled`
(still active until period end), `expired`. Without a plan: `status: "none"`
and the other fields `null`. Cancelling happens in the store; the app opens
`manageUrl`.

### 5.5 `POST /billing/purchases`: verify a store purchase

Auth: JWT. Header `Idempotency-Key`. Called right after the store reports a
successful purchase (subscription or pack). It is also called again for
"Restore purchases".

```json
{
  "platform": "google",
  "productId": "rg_plan_plus_monthly",
  "purchaseToken": "opaque-google-token",
  "transactionId": null
}
```

Apple: `platform: "apple"`, `transactionId` (StoreKit 2) required,
`purchaseToken: null`.

Response `200` (also when the same purchase was already verified):

```json
{
  "success": true,
  "data": {
    "purchase": { "id": "88", "productId": "rg_plan_plus_monthly", "kind": "subscription", "status": "verified", "creditsGranted": 90 },
    "balance": 176,
    "subscription": { "status": "active", "planCode": "plus", "renewsAt": "2026-11-12T00:00:00.000Z" }
  },
  "message": "Purchase verified."
}
```

| Error | HTTP | `errorCode` |
|---|---|---|
| Store says invalid / refunded | 422 | `PURCHASE_INVALID` |
| Purchase belongs to another account | 409 | `PURCHASE_OWNED_BY_OTHER` |
| Store unreachable | 503 | `STORE_UNAVAILABLE` (the app retries later) |

The backend must also handle **App Store Server Notifications v2** and
**Google Real-time Developer Notifications** for renewals, refunds and
expiry. The app never decides credits on its own.

### 5.6 Spending credits (server side)

The server, not the app, deducts credits:

- `POST /virtual-try-on` charges `credits × angles` when the job is created.
  Return `creditsCharged` and `balance` in the response.
- Not enough credits: `402`, `errorCode: "INSUFFICIENT_CREDITS"`,
  `details: { "required": 4, "balance": 2 }`.
- A job that fails or is cancelled refunds its unused angles automatically
  (`type: "refund"` in the history).

---

## 6. Help: contact & FAQ

### 6.1 `GET /support/config`

Public. Drives the Help screen and the "new ticket" form.

```json
{
  "success": true,
  "data": {
    "contact": {
      "email": "hello@redress.global",
      "phone": "+390212345678",
      "whatsapp": null,
      "hours": "Lun–Ven 9:00–18:00",
      "replyTimeHours": 24
    },
    "categories": [
      { "code": "order",   "label": "Ordini",   "desk": "shopper" },
      { "code": "fit",     "label": "Taglie e vestibilità", "desk": "shopper" },
      { "code": "tryOn",   "label": "Try-On",   "desk": "shopper" },
      { "code": "returns", "label": "Resi",     "desk": "shopper" },
      { "code": "account", "label": "Account",  "desk": "shopper" },
      { "code": "other",   "label": "Altro",    "desk": "shopper" }
    ],
    "limits": { "subjectMax": 120, "messageMax": 2000, "attachmentsMax": 3, "attachmentMaxMb": 10 }
  },
  "message": "Support settings retrieved successfully."
}
```

Seller desk categories (same field, `desk: "seller"`): `listing`, `payout`,
`commission`, `returns`, `partnerShipping`, `account`, `other`.

### 6.2 `GET /support/faqs`

Public.

| Query | Note |
|---|---|
| `lang` | `it` / `en` |
| `category` | Optional section code |
| `q` | Optional search in question and answer (case- and accent-insensitive) |

```json
{
  "success": true,
  "data": {
    "sections": [
      {
        "code": "orders",
        "title": "Ordini e spedizioni",
        "items": [
          {
            "id": "12",
            "question": "Quando arriva il mio ordine?",
            "answer": "Di solito in 2–4 giorni lavorativi.\n\nPuoi seguirlo da **Ordini → Traccia**.",
            "link": { "type": "screen", "path": "/orders" },
            "updatedAt": "2026-10-01T00:00:00.000Z"
          }
        ]
      },
      { "code": "returns", "title": "Resi e rimborsi", "items": [] },
      { "code": "tryOn",   "title": "Try-On e crediti", "items": [] },
      { "code": "account", "title": "Account e privacy", "items": [] }
    ]
  },
  "message": "FAQs retrieved successfully."
}
```

| Field | Rule |
|---|---|
| `answer` | Plain text. Paragraphs are separated by `\n\n`; only `**bold**` is allowed |
| `link` | Optional deep link. `type`: `screen` (app path like `/orders`, `/returns`, `/plans`), `policy` (`path` = policy id), or `url` |
| Sections | Return in display order. Empty sections may be omitted |

### 6.3 `POST /support/faqs/{id}/feedback` (optional)

Auth: optional. Body `{ "helpful": true }`. Response `200`, `data: null`.

---

## 7. Message support (tickets + chat)

Each ticket is one conversation. The app shows a list of tickets, then a chat
screen per ticket.

### 7.1 Status flow

| `status` | Meaning | Who moves it |
|---|---|---|
| `open` | Waiting for the support team | New ticket, or the user replies |
| `pending` | Waiting for the user | The agent replies |
| `resolved` | The agent marked it solved | Agent. A user reply moves it back to `open` |
| `closed` | Finished, read-only | The user closes it, or automatically 7 days after `resolved` |

### 7.2 Ticket object (list item)

```json
{
  "id": "41",
  "ticketNumber": "TCK-000041",
  "desk": "shopper",
  "category": "order",
  "categoryLabel": "Ordini",
  "subject": "Where is my order?",
  "status": "pending",
  "statusLabel": "In attesa di tua risposta",
  "orderId": "4",
  "returnId": null,
  "lastMessage": {
    "preview": "Hi Ada, the parcel left Bologna today…",
    "sender": "agent",
    "createdAt": "2026-10-12T15:02:00.000Z"
  },
  "unreadCount": 1,
  "createdAt": "2026-10-12T14:00:00.000Z",
  "updatedAt": "2026-10-12T15:02:00.000Z"
}
```

`preview` is the first ~120 characters. For a message that only has an
attachment, send `"📎 Photo"` (or the translated text).

### 7.3 `GET /support/tickets`

Auth: JWT. Query: `desk` (`shopper` by default), `status` (csv), `page`,
`limit`. Order by `updatedAt` desc.

```json
{
  "success": true,
  "data": {
    "items": [ { "...ticket object (7.2)": "" } ],
    "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 },
    "unreadTotal": 1
  },
  "message": "Tickets retrieved successfully."
}
```

### 7.4 `GET /support/unread-count`

Auth: JWT. A light call for the badge on Profile → Help.

```json
{ "success": true, "data": { "unreadTotal": 1 }, "message": "OK" }
```

### 7.5 `POST /support/tickets`: open a ticket

Auth: JWT. Header `Idempotency-Key`.

```json
{
  "desk": "shopper",
  "category": "order",
  "subject": "Where is my order?",
  "message": "Order RG-1791792000000-AB12 has no tracking yet.",
  "orderId": "4",
  "returnId": null,
  "attachmentIds": ["301"],
  "clientMessageId": "6f1c1e8e-2b2a-4c1b-9a77-0d0c2d1f0a10"
}
```

| Rule | Value |
|---|---|
| `subject` | 3–120 chars |
| `message` | 1–2000 chars (may be empty only when `attachmentIds` is not empty) |
| `orderId` / `returnId` | Optional; must belong to the user, else `404` |
| `attachmentIds` | 0–3 ids from `POST /media` with `purpose=supportAttachment` |
| `desk: "seller"` | Needs an active seller account, else `403` |

Response `201`: the **ticket detail** (7.6) with the first message.

### 7.6 `GET /support/tickets/{id}`: ticket detail

Auth: JWT. Another user's ticket is `404`.

```json
{
  "success": true,
  "data": {
    "...ticket object (7.2)": "",
    "agent": { "name": "Giulia", "avatarUrl": "https://..." },
    "rating": null,
    "actions": { "canReply": true, "canClose": true, "canRate": false }
  },
  "message": "Ticket retrieved successfully."
}
```

| Field | Rule |
|---|---|
| `agent` | `null` until someone is assigned |
| `rating` | `{ "score": 5, "comment": "..." }` or `null` |
| `actions.canReply` | `false` when `closed` |
| `actions.canRate` | `true` when `resolved`/`closed` and not rated yet |

### 7.7 `GET /support/tickets/{id}/messages`

Auth: JWT. The chat screen loads the newest page first, then older ones while
scrolling up, and polls for new messages.

| Query | Use |
|---|---|
| `limit` | Default 30, max 50 |
| `before` | Message id: messages **older** than it (scroll up) |
| `after` | Message id: messages **newer** than it (polling) |

Items are always returned **oldest → newest**.

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "901",
        "ticketId": "41",
        "sender": "user",
        "author": { "name": "Ada Rossi", "avatarUrl": null },
        "body": "Order RG-…-AB12 has no tracking yet.",
        "attachments": [
          { "id": "301", "url": "https://...", "mimeType": "image/jpeg", "name": "parcel.jpg", "sizeBytes": 182340, "width": 1080, "height": 1440 }
        ],
        "clientMessageId": "6f1c1e8e-2b2a-4c1b-9a77-0d0c2d1f0a10",
        "createdAt": "2026-10-12T14:00:00.000Z",
        "readAt": "2026-10-12T14:05:00.000Z"
      },
      {
        "id": "902",
        "ticketId": "41",
        "sender": "agent",
        "author": { "name": "Giulia", "avatarUrl": "https://..." },
        "body": "Hi Ada, the parcel left Bologna today. Tracking: BRT123456789.",
        "attachments": [],
        "clientMessageId": null,
        "createdAt": "2026-10-12T15:02:00.000Z",
        "readAt": null
      },
      {
        "id": "903",
        "ticketId": "41",
        "sender": "system",
        "author": null,
        "body": "Ticket marked as resolved.",
        "attachments": [],
        "clientMessageId": null,
        "createdAt": "2026-10-12T15:03:00.000Z",
        "readAt": null
      }
    ],
    "hasMoreBefore": false,
    "ticketStatus": "pending"
  },
  "message": "Messages retrieved successfully."
}
```

| Field | Rule |
|---|---|
| `sender` | `user`, `agent`, `system` (system = status notes, shown centred) |
| `readAt` | For `user` messages: when the agent read it ("Seen" tick). For others: when the user read it |
| `ticketStatus` | Lets polling update the header and banner without another call |

### 7.8 `POST /support/tickets/{id}/messages`: send

Auth: JWT. Header `Idempotency-Key`.

```json
{
  "body": "Thanks! Any ETA?",
  "attachmentIds": [],
  "clientMessageId": "0b7a7d4e-7d9b-4a8e-a3c4-1f2e3d4c5b6a"
}
```

Response `201`: the message object (7.7). The app shows the message
immediately and matches the server copy by `clientMessageId`.

| Case | Result |
|---|---|
| Ticket `pending` or `resolved` | Status becomes `open` |
| Ticket `closed` | `409` `TICKET_CLOSED` |
| Empty body and no attachment | `422` `VALIDATION` |
| More than 20 messages / minute | `429` |

### 7.9 `POST /support/tickets/{id}/read`

Auth: JWT. Body `{ "lastMessageId": "902" }`. Marks agent and system
messages up to that id as read. Response `200`:
`{ "data": { "unreadCount": 0, "unreadTotal": 0 } }`.

### 7.10 `POST /support/tickets/{id}/close`

Auth: JWT. No body. Response `200`: ticket detail with `status: "closed"`.
Closing again is `200` (no error).

### 7.11 `POST /support/tickets/{id}/rating` (optional)

Auth: JWT. Body `{ "score": 1-5, "comment": "optional, max 500" }`. Only when
`actions.canRate`. Response `200`: ticket detail.

### 7.12 Attachments

Reuse the live `POST /media` (multipart, the same as body photos):

| Field | Value |
|---|---|
| `purpose` | `supportAttachment` |
| `file` | JPG, PNG, WEBP, HEIC or PDF, max 10 MB |

Response `201`: `{ "id": "301", "url": "https://...", "purpose": "supportAttachment" }`.
Only the uploader can attach it, and only once. Attachment URLs must be
private (signed), like body photos.

### 7.13 Real time

- **Push:** when an agent replies, send a `support.message` push (§9.10) with
  the title "Redress Support" and the message preview. A tap opens
  `/support/tickets/{ticketId}`. Support replies do **not** go into the
  notification inbox (the ticket list already shows them as unread).
- **Polling:** while the chat is open, the app calls
  `GET .../messages?after=<lastId>` every 10 s. On the ticket list it calls
  `GET /support/unread-count` when the screen opens.
- A WebSocket can come later; it is not needed for v1.

---

## 8. Policies: privacy, terms, shipping

`GET /content/policies/privacy` is **live**, and the signup consent already
sends its `updatedAt` as `privacyVersion`. Keep that endpoint and shape, and
add the other documents with the **same shape**.

### 8.1 `GET /content/policies`: index

Public.

```json
{
  "success": true,
  "data": {
    "items": [
      { "id": "privacy",  "title": "Informativa privacy",       "updatedAt": "2026-10-09T05:07:32.000Z" },
      { "id": "terms",    "title": "Termini e condizioni",      "updatedAt": "2026-10-01T00:00:00.000Z" },
      { "id": "shipping", "title": "Spedizioni e consegne",     "updatedAt": "2026-10-01T00:00:00.000Z" },
      { "id": "returns",  "title": "Resi e rimborsi",           "updatedAt": "2026-10-01T00:00:00.000Z" },
      { "id": "cookies",  "title": "Cookie",                    "updatedAt": "2026-10-01T00:00:00.000Z" }
    ]
  },
  "message": "Policies retrieved successfully."
}
```

### 8.2 `GET /content/policies/{id}`

Public. `id`: `privacy`, `terms`, `shipping`, `returns`, `cookies`. An unknown
id is `404`.

```json
{
  "success": true,
  "data": {
    "id": "shipping",
    "title": "Spedizioni e consegne",
    "version": "2026-10-01T00:00:00.000Z",
    "updatedAt": "2026-10-01T00:00:00.000Z",
    "effectiveAt": "2026-10-01T00:00:00.000Z",
    "summary": "Consegna in 2–4 giorni lavorativi in Italia. Gratis sopra 49 €.",
    "webUrl": "https://redress.global/legal/shipping",
    "sections": [
      { "heading": "Tempi di consegna", "body": "Italia: 2–4 giorni lavorativi.\n\nIsole: 4–6 giorni lavorativi." },
      { "heading": "Costi",             "body": "Standard 4,90 €, gratis sopra 49 €. Express 9,90 €." },
      { "heading": "Contrassegno",      "body": "Supplemento di 3,00 €." }
    ]
  },
  "message": "Policy retrieved successfully."
}
```

| Field | Rule |
|---|---|
| `version` | **NEW**, optional. If missing the app uses `updatedAt` (as it does today for privacy consent) |
| `effectiveAt`, `summary`, `webUrl` | **NEW**, optional |
| `sections[].body` | Plain text, `\n\n` between paragraphs, only `**bold**` allowed (same as FAQ) |
| Language | Translated by `lang` / `Accept-Language`; send `Content-Language` |
| Cache | Keep the current `ETag`; reply `304` to `If-None-Match`. The app caches policies offline |

The privacy text on the server today is temporary development content. It
must be replaced with the approved text before release (the same applies to
the new documents).

### 8.3 Terms acceptance (optional, later)

If legal requires terms acceptance at signup, accept `termsVersion` next to
`privacyVersion` on `POST /auth/signup` / `POST /auth/consent`. There is no
change for v1.

---

## 9. Notifications

The app has a notification inbox (bell icon on Home, with a badge), filter
chips (All / Orders / Style / Offers), mark one or all as read, and swipe to
delete. Settings has a master **Push** switch and three category switches:
**Order updates**, **Style tips**, **Offers**. Firebase Cloud Messaging (FCM)
is already set up in the app on Android and iOS. Today everything is demo data
and the FCM token never reaches the server.

### 9.1 Categories and types

`category` drives the filter chip, the icon and the settings switch.
`type` is the exact event.

| `category` | Settings switch | `type` values |
|---|---|---|
| `order` | Order updates | `order.confirmed`, `order.shipped`, `order.outForDelivery`, `order.delivered`, `order.cancelled`, `order.deliveryFailed`, `return.approved`, `return.rejected`, `return.received`, `return.refunded`, `return.reminder` (return window closing) |
| `style` | Style tips | `tryOn.completed`, `tryOn.failed`, `fit.ready`, `stylist.picks`, `wishlist.priceDrop`, `wishlist.backInStock` |
| `offer` | Offers | `offer.promo`, `offer.sale`, `offer.coupon` |
| `account` | always on | `credits.low`, `credits.granted`, `subscription.renewed`, `subscription.expiring`, `subscription.paymentFailed` |
| `system` | always on | `security.newLogin`, `security.passwordChanged`, `system.announcement` |

- `support.message` is **push only** (see §7.13) and is not stored in the inbox.
- `account` and `system` cannot be switched off (service and security messages).
- The app shows `account` notifications under the **All** chip with a wallet
  icon, and any unknown `category` under All with the system icon.

### 9.2 Notification object

```json
{
  "id": "1201",
  "type": "order.shipped",
  "category": "order",
  "title": "Ordine spedito",
  "body": "Il tuo Floral Midi Dress è partito da Milano. Seguilo quando vuoi.",
  "imageUrl": "https://...",
  "link": { "type": "screen", "path": "/delivery/4" },
  "data": { "orderId": "4", "orderNumber": "RG-1791792000000-AB12" },
  "read": false,
  "readAt": null,
  "createdAt": "2026-10-13T08:00:00.000Z"
}
```

| Field | Rule |
|---|---|
| `title`, `body` | Already written in the user's saved `locale` (`it` / `en`). Title max 80, body max 240 chars |
| `imageUrl` | Optional (product photo, try-on result). `null` = the app shows the category icon |
| `link.type` | `screen` (app path), `url` (opens browser) or `none` |
| `link.path` | App paths: `/delivery/{orderId}`, `/orders/{orderId}`, `/returns/{returnId}`, `/product/{slug}`, `/try-on`, `/plans`, `/wishlist`, `/support/tickets/{id}`, `/categories?{query}`, `/home` |
| `data` | The ids behind the message, so the app can refresh the right screen. Strings only |

### 9.3 `GET /notifications`: inbox

Auth: JWT.

| Query | Type | Note |
|---|---|---|
| `page`, `limit` | int | See 1.2 (default 20, max 50) |
| `category` | csv | Optional: `order`, `style,offer`… (the filter chips) |
| `unread` | bool | Optional: `true` = only unread |

```json
{
  "success": true,
  "data": {
    "items": [ { "...notification object (9.2)": "" } ],
    "pagination": { "page": 1, "limit": 20, "total": 37, "totalPages": 2 },
    "unreadTotal": 3,
    "unreadByCategory": { "order": 2, "style": 1, "offer": 0, "account": 0, "system": 0 }
  },
  "message": "Notifications retrieved successfully."
}
```

Newest first. Keep notifications for **90 days** (max 200 per user); older
ones may be deleted.

### 9.4 `GET /notifications/unread-count`: badge

Auth: JWT. Light call for the bell badge, made when the app returns to the
foreground and when Home opens. Guests do not call it.

```json
{
  "success": true,
  "data": { "count": 3, "byCategory": { "order": 2, "style": 1, "offer": 0, "account": 0, "system": 0 } },
  "message": "OK"
}
```

`GET /home/feed` already has `meta.unreadNotifications`; it must be the same
number as `count`.

### 9.5 `POST /notifications/{id}/read`

Auth: JWT. No body. Called when a notification is tapped. Reading an already
read notification is `200` (no error). Another user's id is `404`.

```json
{ "success": true, "data": { "id": "1201", "read": true, "readAt": "2026-10-13T09:00:00.000Z", "unreadTotal": 2 }, "message": "Notification marked as read." }
```

### 9.6 `POST /notifications/read-all`

Auth: JWT. "Mark all as read".

```json
{ "category": null, "before": "2026-10-13T09:00:00.000Z" }
```

| Field | Rule |
|---|---|
| `category` | Optional: only that category (the active chip). `null` = all |
| `before` | Optional: only notifications created up to this time, so one that arrives while the request runs stays unread |

Response `200`: `{ "data": { "updated": 3, "unreadTotal": 0 } }`.

### 9.7 Delete

| Call | Use | Response |
|---|---|---|
| `DELETE /notifications/{id}` | Swipe to delete | `200`, `data: { "unreadTotal": 2 }`. Already deleted = `200` |
| `DELETE /notifications` | "Clear all" (optional `?category=`) | `200`, `data: { "deleted": 12, "unreadTotal": 0 }` |

### 9.8 Notification settings

The Settings switches, saved per account so they work on every device and
the **server** can skip pushes the user turned off.

`GET /me/notification-settings` (JWT). A new user gets the defaults, not 404.

```json
{
  "success": true,
  "data": {
    "push": {
      "enabled": true,
      "orderUpdates": true,
      "styleTips": true,
      "offers": false
    },
    "email": {
      "orderUpdates": true,
      "offers": false
    },
    "quietHours": { "enabled": false, "from": "22:00", "to": "08:00", "timeZone": "Europe/Rome" },
    "updatedAt": "2026-10-13T09:00:00.000Z"
  },
  "message": "Notification settings retrieved successfully."
}
```

`PATCH /me/notification-settings` (JWT): send only what changed. Response
`200`: the full settings object.

```json
{ "push": { "offers": true } }
```

| Rule | Value |
|---|---|
| `push.enabled = false` | No push at all (inbox items are still created) |
| `orderUpdates` / `styleTips` / `offers` | Skip the push **and** the email for that category. Inbox items are still created |
| `account`, `system`, `support.message` | Always sent (service / security) |
| `offers` default | **`false`** until the user switches it on (marketing consent, GDPR / ePrivacy). Store when it was switched on |
| `quietHours` | Optional. Offers / style pushes inside the window are delayed to `to`; order and security pushes are sent immediately |

On first sign-in the app sends its local switch values once with `PATCH`, then
the server copy wins.

### 9.9 Push devices (FCM tokens)

`POST /me/devices` (JWT): register or refresh this phone. Called after login,
when FCM gives a new token, and when the Push switch is turned on.

```json
{
  "token": "fcm-registration-token",
  "provider": "fcm",
  "platform": "android",
  "deviceId": "8d7f0c2e-5a1b-4c6e-9e3d-2b1a0f9c8e7d",
  "appVersion": "1.4.0",
  "locale": "it",
  "timeZone": "Europe/Rome"
}
```

| Field | Rule |
|---|---|
| `token` | Required. **Upsert by token**: the same token on another account moves to this account |
| `provider` | `fcm` (also used for iOS through Firebase) |
| `platform` | `android` or `ios` |
| `deviceId` | Stable random id the app keeps per install; one row per `deviceId`, so a new token replaces the old one |
| `locale` | Language for push text on this device |

Response `200`: `{ "data": { "id": "77", "token": "…", "platform": "android", "updatedAt": "…" } }`.

`DELETE /me/devices/{token}` (JWT): called when the Push switch is turned off
and **before logout**. Unknown token = `200`. Also on `POST /auth/logout`
the server should remove the session's device tokens if the app sends
`deviceToken` in the body.

Server rules:
- When FCM answers `UNREGISTERED` / `INVALID_ARGUMENT`, delete that token.
- Remove tokens not refreshed for 60 days.
- Max 10 devices per user (drop the oldest).

### 9.10 Push payload (what the server sends to FCM)

```json
{
  "message": {
    "token": "fcm-registration-token",
    "notification": {
      "title": "Ordine spedito",
      "body": "Il tuo Floral Midi Dress è partito da Milano.",
      "image": "https://..."
    },
    "data": {
      "notificationId": "1201",
      "type": "order.shipped",
      "category": "order",
      "route": "/delivery/4",
      "orderId": "4"
    },
    "android": {
      "priority": "high",
      "notification": { "channel_id": "redress_marketplace", "tag": "order-4" }
    },
    "apns": {
      "payload": { "aps": { "badge": 3, "sound": "default", "thread-id": "order-4" } }
    }
  }
}
```

| Rule | Value |
|---|---|
| `data` values | Strings only (FCM rule) |
| `data.category` | **Required**: the app uses it to respect the switches while open |
| `data.route` | Same as `link.path`; empty for `link.type = none` |
| `data.notificationId` | The inbox id; a tap marks it read. Empty for `support.message` |
| Android channel | `redress_marketplace` (already created by the app) |
| iOS badge | The user's `unreadTotal` after this notification |
| `tag` / `thread-id` | Groups updates for the same order / ticket so they replace each other |
| Language | The device `locale` (else the user's `locale`) |

### 9.11 Guests

Guests have no inbox (the bell opens login). A guest device token may be
registered with the `X-Guest-Token` header instead of a JWT, for offers only,
and is linked to the account at login. This is optional for v1.

---

## 10. Screen → API map

| App screen | Route in app | Calls |
|---|---|---|
| Returns list | `/returns` | `GET /returns` |
| Return detail | `/returns/:id` | `GET /returns/{id}`, `POST /returns/{id}/cancel` |
| Start return | `/orders/:orderId/return`, `/returns/start` | `GET /orders?returnable=true`, `GET /orders/{id}`, `POST /returns` |
| Order tracking | `/delivery/:orderId` | `GET /orders/{id}/tracking` |
| AI preferences | `/ai-preferences` | `GET /ai-preferences/options`, `GET/PUT/DELETE /me/ai-preferences` |
| Plans & credits | `/plans` | `GET /billing/plans`, `GET /me/credits`, `GET /me/subscription`, `POST /billing/purchases` |
| Credit history | new screen under `/plans` | `GET /me/credits/transactions` |
| Try-On | `/try-on` | `POST /virtual-try-on` (charges credits, §5.6) |
| Help & support | `/support` | `GET /support/config`, `GET /support/faqs`, `GET /support/unread-count` |
| My tickets | `/support/tickets` | `GET /support/tickets` |
| New ticket | `/support/tickets/new` | `POST /media`, `POST /support/tickets` |
| Chat | `/support/tickets/:id` | `GET /support/tickets/{id}`, `GET .../messages`, `POST .../messages`, `POST .../read`, `POST .../close`, `POST .../rating` |
| Policies | `/policies`, `/policies/:id` | `GET /content/policies`, `GET /content/policies/{id}` |
| Notifications | `/notifications` | `GET /notifications`, `POST /notifications/{id}/read`, `POST /notifications/read-all`, `DELETE /notifications/{id}` |
| Home bell badge | `/home` | `GET /notifications/unread-count` (or `meta.unreadNotifications`) |
| Settings → notifications | `/settings` | `GET/PATCH /me/notification-settings`, `POST/DELETE /me/devices` |
| Login / logout | `/auth` | `POST /me/devices` after login, `DELETE /me/devices/{token}` before logout |

---

## 11. Acceptance checklist

**Returns**
- [ ] `GET /orders/{id}` lines have `orderItemId`, `returnableQty` and the real product title; the order has `returnDeadlineAt`.
- [ ] `actions.canReturn` is `false` after day 14 or when nothing is left to return.
- [ ] `GET /returns` and `GET /returns/{id}` work for the owner; another user's id is `404`.
- [ ] The new return shows `requested` + `refundStatus: not_started`, with the full timeline (future steps `done: false`).
- [ ] Cancelling a `requested` return gives `cancelled` and frees `returnableQty`; any other status is `409`.

**Tracking**
- [ ] Before shipping: `200` with a timeline and `shipments: []` (never `404`).
- [ ] After shipping: carrier, tracking number, `trackingUrl`, events newest first.
- [ ] Labels follow `lang`.

**AI preferences**
- [ ] A new user's `GET` is empty lists, not `404`.
- [ ] `PUT` replaces everything; an unknown code is `422` with `details.fields`.
- [ ] `DELETE` resets.

**Credits**
- [ ] `GET /billing/plans` without a token returns Base / Plus / Pro + the 20-credit pack with store product ids.
- [ ] `POST /billing/purchases` is idempotent (the same token twice grants once).
- [ ] Try-On deducts on the server; with too few credits it is `402 INSUFFICIENT_CREDITS`; a failed job refunds.
- [ ] Renewals and refunds arrive through the Apple / Google server notifications.

**Support**
- [ ] Create ticket → first message present; `Idempotency-Key` stops duplicates.
- [ ] An agent reply sets `pending`, a user reply sets `open`, a reply to `closed` is `409`.
- [ ] `messages?after=` returns only newer messages, oldest → newest.
- [ ] `unreadCount` / `unreadTotal` drop to 0 after `/read`.
- [ ] Push `support.message` on an agent reply.
- [ ] Attachments are private and limited to 3 × 10 MB.

**Notifications**
- [ ] An order status change creates an inbox item **and** sends a push with `data.category` and `data.route`.
- [ ] `GET /notifications?category=order` filters; `unreadTotal` matches `/unread-count` and the home feed `meta`.
- [ ] Read, read-all (with `before`) and delete are all `200` when repeated.
- [ ] A switched-off category gets no push but still appears in the inbox; `account` / `system` are always sent.
- [ ] `offers` is `false` for a new user until switched on.
- [ ] The same FCM token logged in on another account moves to the new account; logout removes it; `UNREGISTERED` tokens are deleted.
- [ ] Push text is in the device / user language.

**Content**
- [ ] `terms`, `shipping`, `returns`, `cookies` return the same shape as `privacy`, in `it` and `en`.
- [ ] `ETag` / `304` works.
- [ ] FAQ search `q` ignores case and accents.

---

## 12. Questions for the business / backend

1. **Monthly credits:** do unused subscription credits roll over, or expire at the period end? (`expiring` in §5.2 assumes they expire.)
2. **Welcome credits:** how many credits does a new account get (the app demo uses 86)?
3. **Return shipping:** is it free, or deducted from the refund? If deducted, add `refund.deductions: [{ label, amount }]`.
4. **Return method:** only carrier drop-off (QR / label), or home pickup too? Pickup would need `method` on `POST /returns` and a pickup slot.
5. **Support hours / SLA:** confirm `replyTimeHours` and whether a WhatsApp channel is planned.
6. **Store product ids:** confirm the final Apple / Google product ids before the store listings are created.
7. **Email notifications:** are order emails sent today? If yes, they should follow the same `email.orderUpdates` switch (§9.8).
8. **Marketing pushes:** who sends offer / sale pushes (admin panel, scheduled campaigns)? They must use the same inbox + push path and respect `offers` and quiet hours.
