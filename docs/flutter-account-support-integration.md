# Redress Flutter — Account, Support & Post-purchase API

This is the Redress-owned integration contract for Flutter shopper screens.
It is deliberately split by delivery phase so Flutter only calls endpoints that
are marked **Live**. A **Planned** endpoint and its JSON shape are an agreed
target, not an endpoint that may be called until its status changes to Live.

Last reviewed: 13 October 2026

## 1. Shared contract

Base URL:

```text
https://redressbackend.cyberimpulses.com/api/v1
```

Authenticated requests send:

```http
Authorization: Bearer <accessToken>
Accept: application/json
Content-Type: application/json
Accept-Language: en | it
```

`?lang=en` or `?lang=it` may be used where documented and takes precedence
over `Accept-Language`.

All successful responses use:

```json
{
  "success": true,
  "data": {},
  "message": "Human-readable result message."
}
```

Errors use:

```json
{
  "success": false,
  "data": null,
  "message": "A shopper-readable explanation.",
  "errorCode": "STABLE_CODE",
  "details": {
    "fields": {
      "items[0].quantity": "max"
    }
  }
}
```

- IDs are strings in responses; Flutter should accept numeric strings.
- Dates are ISO-8601 UTC strings.
- Money values are JSON numbers paired with `currency`.
- Empty lists are `[]`, never `null`.
- A `404` for an owned resource also protects privacy: do not infer whether the
  resource exists for another account.

### Error handling

| Status | Flutter behaviour |
| --- | --- |
| `400` | Invalid client query/body; do not retry automatically. |
| `401` | Refresh the session once, then return to sign-in if needed. |
| `403` | Show the returned message. |
| `404` | Show the not-found state. |
| `409` | Refresh the affected screen; state changed elsewhere. |
| `422` | Keep the form visible and show `message` / `details.fields`. |
| `429` | Show retry-later feedback. |
| `5xx` | Keep current content and offer retry. |

## 2. Delivery status

| Phase | Area | Status |
| --- | --- | --- |
| Existing | Orders, creating a return, privacy policy | Live |
| 1 | Order returnability, return history/detail/cancel, order tracking | Ready for deployment |
| 2 | Policy index, Terms/Shipping/Returns/Cookies, FAQ | Planned |
| 3 | AI preferences | Planned |
| 4 | Notifications and devices | Planned |
| 5 | Support tickets and private attachments | Planned |
| 6 | Credits, subscriptions and store purchase verification | Planned |

Do not block checkout or Orders on phases 2–6.

---

## 3. Orders and returns — Phase 1

All endpoints in this section require a shopper JWT.

### `GET /orders/:id` — order detail

Status: **Ready for deployment.**

The detailed response will include the following fields required by the return
form. Flutter must use `orderItemId`, not product ID, when creating a return.

```json
{
  "success": true,
  "data": {
    "id": "4",
    "orderNumber": "RG-1791792000000-AB12",
    "status": "delivered",
    "currency": "EUR",
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
        "imageUrl": "https://redressbackend.cyberimpulses.com/api/v1/media/..."
      }
    ],
    "returnDeadlineAt": "2026-10-20T10:00:00.000Z",
    "actions": {
      "canCancel": false,
      "canTrack": true,
      "canReturn": true
    }
  },
  "message": "Order retrieved successfully."
}
```

`returnableQty` is zero when no units can be selected. `returnDeadlineAt` is
`null` before delivery. `canReturn` is only true when the order was delivered,
the 14-day window is open, and at least one line has a returnable quantity.

### `POST /returns` — request a return

Status: **Ready for deployment.**

Flutter should disable the submit action while this request is in flight. The
current Phase 1 endpoint does not yet persist idempotency keys, so it must not
automatically replay an uncertain create request after a network timeout.

Request:

```json
{
  "orderId": 4,
  "items": [
    {
      "orderItemId": 17,
      "quantity": 1,
      "reason": "sizeFit",
      "note": "Too small"
    }
  ]
}
```

`reason` is one of `sizeFit`, `quality`, `notAsDescribed`, `changedMind`,
`damaged`, or `other`. A non-empty `note` is mandatory when the reason is
`other`.

Expected business errors:

| Status | `errorCode` |
| --- | --- |
| `422` | `ORDER_NOT_DELIVERED` |
| `422` | `RETURN_WINDOW_EXPIRED` |
| `422` | `RETURN_QTY_EXCEEDED` |
| `422` | `VALIDATION` |
| `404` | `NOT_FOUND` |

### `GET /returns` — return history

Status: **Ready for deployment.**

Query: `page` (default `1`), `limit` (default `20`, max `50`), optional
`status` CSV, optional `orderId`.

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
        "statusLabel": "Approved",
        "refundStatus": "not_started",
        "refundAmount": 47.94,
        "currency": "EUR",
        "itemCount": 1,
        "previewImageUrl": "https://redressbackend.cyberimpulses.com/api/v1/media/...",
        "requestedAt": "2026-10-12T11:10:00.000Z",
        "updatedAt": "2026-10-12T15:00:00.000Z"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
  },
  "message": "Returns retrieved successfully."
}
```

### `GET /returns/:id` — return detail

Status: **Ready for deployment.**

```json
{
  "success": true,
  "data": {
    "id": "31",
    "returnNumber": "RT-000031",
    "orderId": "4",
    "orderNumber": "RG-1791792000000-AB12",
    "status": "approved",
    "statusLabel": "Approved",
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
          "imageUrl": "https://redressbackend.cyberimpulses.com/api/v1/media/..."
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
    "shipment": null,
    "timeline": [
      { "status": "requested", "label": "Requested", "description": null, "at": "2026-10-12T11:10:00.000Z", "done": true },
      { "status": "approved", "label": "Approved", "description": null, "at": null, "done": false },
      { "status": "inTransit", "label": "In transit", "description": null, "at": null, "done": false },
      { "status": "refundPending", "label": "Refund pending", "description": null, "at": null, "done": false },
      { "status": "refunded", "label": "Refunded", "description": null, "at": null, "done": false }
    ],
    "actions": { "canCancel": true }
  },
  "message": "Return retrieved successfully."
}
```

Return statuses are `requested`, `approved`, `inTransit`, `refundPending`,
`refunded`, `rejected`, and `cancelled`. The exact persisted-state migration
will be completed before this endpoint is marked Live.

### `POST /returns/:id/cancel` — cancel requested return

Status: **Ready for deployment.**

No request body. Only allowed while the return is `requested`.

```json
{
  "success": true,
  "data": { "id": "31", "status": "cancelled", "actions": { "canCancel": false } },
  "message": "Return cancelled successfully."
}
```

Any later state returns `409` with `RETURN_NOT_CANCELLABLE`.

### `GET /orders/:id/tracking` — tracking

Status: **Ready for deployment.**

The first implementation exposes the existing fulfillment as a one-item
`shipments` array. A future fulfillment phase can add per-vendor parcels
without changing this response shape.

```json
{
  "success": true,
  "data": {
    "orderId": "4",
    "orderNumber": "RG-1791792000000-AB12",
    "status": "shipped",
    "statusLabel": "Shipped",
    "estimatedDelivery": null,
    "deliveredAt": null,
    "address": { "fullName": "Ada Rossi", "city": "Milano", "postalCode": "20121", "country": "IT" },
    "timeline": [
      { "code": "placed", "label": "Placed", "at": "2026-10-12T10:00:00.000Z", "done": true },
      { "code": "confirmed", "label": "Confirmed", "at": "2026-10-12T10:05:00.000Z", "done": true },
      { "code": "packed", "label": "Packed", "at": null, "done": false },
      { "code": "shipped", "label": "Shipped", "at": "2026-10-13T08:00:00.000Z", "done": true },
      { "code": "outForDelivery", "label": "Out for delivery", "at": null, "done": false },
      { "code": "delivered", "label": "Delivered", "at": null, "done": false }
    ],
    "shipments": [
      {
        "id": "9",
        "orderItemIds": ["17"],
        "carrier": { "code": "carrier", "name": "Carrier", "phone": null },
        "trackingNumber": "TRACKING-123",
        "trackingUrl": "https://carrier.example/track/TRACKING-123",
        "status": "inTransit",
        "statusLabel": "In transit",
        "shippedAt": "2026-10-13T08:00:00.000Z",
        "estimatedDelivery": null,
        "events": []
      }
    ]
  },
  "message": "Order tracking retrieved successfully."
}
```

Before an order ships, this endpoint still returns order-level timeline data
with `shipments: []`; Flutter must not treat that as an error. Poll no more
than once every 60 seconds while the tracking screen is visible.

---

## 4. Policies and FAQ — Phase 2

### `GET /content/policies/privacy`

Status: **Live.** The existing privacy-policy route remains compatible.

### `GET /content/policies` and `GET /content/policies/:id`

Status: **Planned.** Policy IDs: `privacy`, `terms`, `shipping`, `returns`,
and `cookies`. Flutter should cache policies by `version`/ETag once Live.

### `GET /support/config` and `GET /support/faqs`

Status: **Planned.** They provide support contact details, ticket categories,
localized FAQ sections, and optional deep links. These are public endpoints.

---

## 5. AI preferences — Phase 3

| Endpoint | Auth | Status |
| --- | --- | --- |
| `GET /ai-preferences/options` | No | Planned |
| `GET /me/ai-preferences` | JWT | Planned |
| `PUT /me/ai-preferences` | JWT | Planned |
| `DELETE /me/ai-preferences` | JWT | Planned |

The saved preference shape is:

```json
{
  "shopFor": ["women"],
  "styles": ["minimal", "elegant"],
  "occasions": ["work"],
  "colors": ["black", "beige"],
  "fit": "regular",
  "goals": ["essentials"],
  "selectedCount": 7,
  "updatedAt": "2026-10-12T09:30:00.000Z"
}
```

Missing values are returned as empty arrays and `fit: null`, never `404`.

---

## 6. Notifications — Phase 4

| Endpoint | Status | Purpose |
| --- | --- | --- |
| `GET /notifications` | Planned | Paginated inbox. |
| `GET /notifications/unread-count` | Planned | Badge count. |
| `POST /notifications/:id/read` | Planned | Mark one notification read. |
| `POST /notifications/read-all` | Planned | Mark all/current category read. |
| `DELETE /notifications/:id` | Planned | Remove one inbox item. |
| `GET/PUT /me/notification-settings` | Planned | Push and category consent preferences. |
| `POST /me/devices`, `DELETE /me/devices/:id` | Planned | Register/revoke FCM/APNs device tokens. |

An inbox item will contain `id`, `category`, `type`, localized `title` and
`body`, optional `imageUrl`, `link`, `data`, `readAt`, and `createdAt`.
Offer/marketing push is opt-in; inbox records may still exist when push is off.

---

## 7. Support tickets — Phase 5

| Endpoint | Status |
| --- | --- |
| `GET /support/tickets` | Planned |
| `GET /support/unread-count` | Planned |
| `POST /support/tickets` | Planned |
| `GET /support/tickets/:id` | Planned |
| `GET /support/tickets/:id/messages` | Planned |
| `POST /support/tickets/:id/messages` | Planned |
| `POST /support/tickets/:id/read` | Planned |
| `POST /support/tickets/:id/close` | Planned |
| `POST /support/tickets/:id/rating` | Planned, optional |

Ticket and message creation require `Idempotency-Key`; messages also use a
`clientMessageId` UUID so Flutter can reconcile an optimistic message with the
server copy. Private support attachments will be introduced together with this
phase; Flutter must not use body-profile media uploads for ticket attachments.

---

## 8. Credits and subscriptions — Phase 6

| Endpoint | Auth | Status |
| --- | --- | --- |
| `GET /billing/plans` | No | Planned |
| `GET /me/credits` | JWT | Planned |
| `GET /me/credits/transactions` | JWT | Planned |
| `GET /me/subscription` | JWT | Planned |
| `POST /billing/purchases` | JWT | Planned |

Flutter purchases digital credits/subscriptions through Apple In-App Purchase
or Google Play Billing and sends the receipt/token to the server. The server
verifies it and owns the final balance and entitlement. Flutter must never
grant credits locally.

## 9. Flutter implementation rules

1. Call only endpoints marked **Live**.
2. Keep the last successful content on screen during refresh.
3. Use returned `link`/IDs; do not build routes or image URLs from storage
   keys.
4. Treat nullable optional fields as valid data, not a parsing failure.
5. Use idempotency keys only when the endpoint documentation explicitly says
   they are supported.
6. Do not cache mutable order, return, ticket, notification, credit, or
   subscription responses as permanent local truth; refresh after an action.

## 10. Related contracts

- `backend-signup-fit-api.md` — authentication, onboarding, profiles and fit.
- `backend-shop-commerce-api.md` — catalog, bag, checkout, payments and base
  orders contract.
- `home-flutter-handoff.md` — shopper Home feed only.
