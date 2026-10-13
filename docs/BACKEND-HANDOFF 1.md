# What to send the backend team

**Send only these files.** They are the shopper demand contracts.

| # | File | What they must build |
| --- | --- | --- |
| 1 | [`backend-signup-fit-api.md`](./backend-signup-fit-api.md) | Signup (phone / email / Google + privacy consent) and fit setup (about you → measurements → photos) |
| 2 | [`backend-shop-commerce-api.md`](./backend-shop-commerce-api.md) | Categories, filters, search, product page, bag, buy now, checkout, payments, orders, cancel, return, tracking |
| 3 | [`backend-account-support-api.md`](./backend-account-support-api.md) | Return history/detail, order tracking, AI preferences, plans/credits/subscriptions, FAQ, support chat, notifications + push devices, privacy/terms/shipping policies |

If a path or body differs in any older doc, **these files win**.

Optional extra (only if they ask “what about login / home?”):

| File | Use |
| --- | --- |
| [`auth-flows.md`](./auth-flows.md) | Login, OTP, refresh, logout, forgot password, `PATCH /auth/me`. **Do not rebuild signup from this file** — signup is in file 1. |
| [`home-screen-flows.md`](./home-screen-flows.md) | Home feed only (`GET /home/feed`). Not required for Categories → order. |

Do **not** treat these as the shopper contract: `catalog-screen-flows.md`, `backend-api.md`, `signup-and-fit-setup.md`, `shopper-account-flows.md`.

---

## Shopper app — covered or not

Every shopper route in the Flutter app.

### Covered in file 1 — signup + fit

| App screen | Route | API |
| --- | --- | --- |
| Sign in / sign up | `/auth` `/otp` `/signup` | OTP, Google `signup_required`, `POST /auth/signup` + `consent` |
| Forgot password | `/forgot-password` … | Already in `auth-flows.md` — no change |
| Fit: about you | `/fit/about` | `POST/PATCH /body-profiles` (sex, height, weight) |
| Fit: method | `/fit/method` | none |
| Fit: 2 scan photos | `/fit/scan` | `POST /fit/measurements/estimate` — **not stored** |
| Fit: measurements | `/fit/measurements` | `PATCH /body-profiles/:id` |
| Fit: profile photos | `/fit/photos` | `POST /media` (`bodyPhoto`) + PATCH photos |
| Body profiles | `/body-profiles` | same body-profile APIs |
| Privacy policy (consent version) | `/policies/privacy` | `GET /content/policies/privacy` |

### Covered in file 2 — shop + checkout + orders

| App screen | Route | API |
| --- | --- | --- |
| Categories | `/categories` | `/catalog/filters` `/catalog/categories` `/catalog/products` (`q` = search) |
| Product | `/product/:id` | `/catalog/products/{slug}` |
| Reviews | `/product/:id/reviews` | `/catalog/products/{slug}/reviews` |
| Wishlist | `/wishlist` | `/wishlist` |
| Bag | `/bag` | `/cart` |
| Checkout | `/checkout` | `/checkout/quote` `POST /checkout` `/payments/:id/confirm` |
| Address book | `/addresses` | `/addresses` |
| Orders | `/orders` `/orders/:id` | `/orders` |
| Tracking | `/delivery/:orderId` | `/orders/:id/tracking` |
| Returns | `/returns` … | `/returns` |

### Already live / do not rebuild (auth-flows)

| App screen | Route | Status |
| --- | --- | --- |
| Login, refresh, logout | `/auth` | Exists |
| Forgot / reset password | `/forgot-password` | Exists |
| Edit profile | `/profile/edit` | `GET/PATCH /auth/me` in `auth-flows.md` |

### Not in these files — later phase

Keep them on demo / existing home API. **Do not block** Categories → place order on these.

| App screen | Route | Why later |
| --- | --- | --- |
| Home rails | `/home` | `GET /home/feed` is a separate doc. Categories does not need it. |
| Style Studio / try-on | `/try-on` | AI jobs, not commerce. |
| Stylist / chronology | `/stylist` `/chronology` | Demo / future. |
| Seller hub | `/seller/…` | Not shopper. |

---

## One shopper path (what we need now)

```text
Auth (file 1)
   → Fit setup optional (file 1)
   → Categories + search + filters (file 2)
   → Product (file 2)
   → Add to bag  or  Buy now (file 2)
   → Checkout 3 steps (file 2)
   → Place order (file 2)
   → Orders / cancel / track / return (file 2)
```

That is the whole shopper **buy** path. Home, try-on, support, and seller are outside it.

---

## How to reply if they ask

**“Is this the full shopper app?”**  
No. It is the full **account + catalogue + bag + checkout + orders** path. Home feed, try-on, support, and notifications are a later pack.

**“Which catalog paths?”**  
`/catalog/*` as in file 2. Alias `/products` if you already have it.

**“Signup vs old auth doc?”**  
File 1 wins: consent required, Google new user = `signup_required`, no account until confirm.

**“Two kinds of photos?”**  
Scan (front + side) = estimate only, never stored. Profile photos = private `/media` + body profile.
