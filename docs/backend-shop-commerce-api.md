# Shop API — Categories to orders

Version 2.0 — 9 October 2026
Status: **final for backend implementation**
Audience: backend. Owner: Flutter (`CatalogScreen`, PDP, bag, checkout, orders).

Base URL:

```text
https://redressbackend.cyberimpulses.com/api/v1
```

**Give this file + [`backend-signup-fit-api.md`](./backend-signup-fit-api.md) to backend.** Cover sheet: [`BACKEND-HANDOFF.md`](./BACKEND-HANDOFF.md).

This file is **shop + bag + checkout + orders only**. Signup and fit setup are in the other file. Home feed, try-on, support, and notifications are **not** in this pack.

Where this file differs on catalog / cart / checkout / orders, **this file wins**.

---

## How the Categories tab works today

Route: `/categories` → `CatalogScreen`.

```text
 App bar:  Categories                              [search]
 Chips:    All | Women | Men | Kids | Accessories
           [ Categories ▾ ]  [ Filters ]  [ Price ]  [ Try-on ]  [ Sort: discount ]
 Grid:     product cards
```

| UI control | Local state | Must become this API call |
| --- | --- | --- |
| Open tab | — | `GET /catalog/filters` + `GET /catalog/categories` + `GET /catalog/products` |
| Audience chip | `_audience` | products `audience=` and/or `category=womenswear\|menswear\|kids\|accessories` |
| Categories sheet | `_categoryId` = **slug** | products `category=<slug>` |
| Search field | `_searchQuery` | products `q=` (**server search only**, debounce 300 ms) |
| Filters sheet | brands, colors, sizes, min discount | products `brand=`, `color=`, `size=`, `minDiscount=` |
| Price sheet | `_priceRange` | products `minPrice=` `maxPrice=` |
| Try-on chip | `_tryOnOnly` | products `tryOn=true` |
| Sort chip | `_sortByDiscount` | products `sort=discount` (not `price_asc`) |
| Pull to refresh | — | same three GETs again |
| Tap card | — | `GET /catalog/products/{slug}` |

The app already calls `/catalog/filters`, `/catalog/categories`, `/catalog/brands`, `/catalog/products`, `/catalog/products/{slug}`. This file **freezes those paths and bodies** so the demo fallback can be ejected.

---

## 1. Shared rules

```http
Accept: application/json
Content-Type: application/json
Accept-Language: it
```

Browse is public. Optional `Authorization: Bearer`. Guest cart: signed `X-Guest-Token` for native clients, or the HttpOnly guest cookie for web clients. Protected commerce: JWT.

Italian is default. `?lang=it|en` overrides the header. Category names, colour names, size labels, sort names follow the language. Product title, brand, description stay in the author's language.

Success: `{ "success": true, "data": { }, "message": "Operation completed successfully." }`.

Failure: `{ "success": false, "data": null, "message": "The request contains invalid fields." }`.

List of products uses **page numbers** (the app already sends these):

```json
{
  "data": [ ],
  "meta": { "page": 1, "limit": 20, "total": 128, "totalPages": 7 }
}
```

| Query | Default | Rule |
| --- | --- | --- |
| `page` | 1 | 1-based |
| `limit` | 20 | Max 50. Categories grid sends `40` |
| `lang` | from `Accept-Language` | `it` or `en` |

Errors use the same envelope as successful responses:

```json
{
  "success": false,
  "data": null,
  "message": "The request contains invalid fields."
}
```

| HTTP | Meaning |
| --- | --- |
| 400 | Invalid request |
| 401 | Authentication or guest session is invalid or expired |
| 404 | Requested resource was not found |
| 409 | Request conflicts with current state |
| 422 | Input is valid JSON but cannot be processed |
| 429 | Rate limit exceeded |

Money on catalog cards may stay as **strings** inside the `price` object (the app already parses them). Money on cart / quote / orders is a JSON **number**, 2 decimals, EUR. VAT 22% is included in shelf prices; never add it on top.

Only **live** listings appear. Empty catalogue → empty `data`, never fake products.

---

## 2. Catalogue — categories, filters, search, grid

### 2.1 Audiences (the five chips)

| Chip | `audience` query | Root category slug the app also sends when no leaf is picked |
| --- | --- | --- |
| All | omit | omit `category` |
| Women | `women` | `womenswear` |
| Men | `men` | `menswear` |
| Kids | `kids` | `kids` |
| Accessories | `accessories` | `accessories` |

Those four root slugs **must exist** in the category tree. `GET /catalog/products?category=womenswear` returns every live women’s product.

Home deep-links the app already reads: `?audience=women`, `?brand=atelier`, `?category=dresses`, `?search=1`.

---

### 2.2 Category tree (Categories sheet)

The sheet is **exactly two levels**:

```text
 [ All ]

  │ Western wear
    [ All Western wear ]     ← pick root.slug
    [ Dresses ]              ← pick child.slug
    [ Tops ]
    [ Jeans ]

  │ Footwear
    [ All Footwear ]
    [ Heels ]
    …
```

There is a search box on the sheet (`shopCategorySearch`). It filters **names locally**. No extra API.

**`GET /catalog/categories`**

```http
GET /catalog/categories?audience=women&lang=it
```

| Query | Required | Rule |
| --- | --- | --- |
| `audience` | no | `women` `men` `kids` `accessories`. Omit = all shopper groups (not home/beauty) |
| `lang` | no | `it` / `en` |

Response `200` — **array of roots**. Each root has `children` (leaves). No third level.

```json
{
  "data": [
    {
      "id": "41",
      "code": "WESTERN",
      "slug": "western",
      "name": "Abbigliamento",
      "description": null,
      "imageUrl": "https://cdn.example.com/cat/western.jpg",
      "children": [
        {
          "id": "42",
          "code": "DRESSES",
          "slug": "dresses",
          "name": "Vestiti",
          "description": null,
          "imageUrl": null,
          "children": []
        },
        {
          "id": "43",
          "code": "TOPS",
          "slug": "tops",
          "name": "Top",
          "children": []
        }
      ]
    },
    {
      "id": "50",
      "code": "FOOTWEAR",
      "slug": "footwear-women",
      "name": "Scarpe",
      "children": [
        { "id": "51", "code": "HEELS", "slug": "heels", "name": "Tacchi", "children": [] }
      ]
    }
  ]
}
```

| Field | App uses it as |
| --- | --- |
| `slug` | The value stored in `_categoryId` and sent as `category=` |
| `name` | Label on the chip and in the sheet (`Accept-Language`) |
| `imageUrl` | Optional; ignored for now |
| `children` | Leaf rows. Empty array if the root has no leaves |
| `id` / `code` | Stable ids. App does not send them on the product query |

**Slug rules**

- Unique in the whole tree.
- Lowercase, hyphenated (`casual-shoes`, `footwear-women`).
- The four audience roots: `womenswear`, `menswear`, `kids`, `accessories`.
- Picking “All {root}” sends **the root slug**. Picking a leaf sends **the leaf slug**. Picking “All” sends nothing (clears `category`).
- `GET /catalog/products?category=western` = every product under that root (all children).
- `GET /catalog/products?category=dresses` = only that leaf.

When `audience=women` is also sent, `category=dresses` means women’s dresses only (kids also have dresses).

**Required shopper tree** (ids are slugs). Home and Beauty stay out of this tab.

**Women** (`audience=women`, parent `womenswear`)

| Root slug | Children slugs |
| --- | --- |
| `western` | `dresses`, `tops`, `jeans`, `skirts`, `jackets` |
| `footwear-women` | `heels`, `flats`, `sneakers`, `slippers` |
| `bags-women` | `handbags`, `backpacks` |
| `lingerie` | `sleepwear` |
| `sports-women` | `activewear` |

**Men** (parent `menswear`)

| Root slug | Children slugs |
| --- | --- |
| `topwear` | `tshirts`, `shirts`, `jackets-men`, `sweatshirts` |
| `bottomwear` | `jeans-men`, `trousers`, `shorts` |
| `footwear-men` | `casual-shoes`, `sneakers-men`, `slippers-men` |
| `accessories-men` | `belts`, `watches`, `bags-men` |
| `innerwear` | `briefs`, `vests` |
| `sports-men` | `sports-shoes`, `track-pants` |

**Kids** (parent `kids`)

| Root slug | Children slugs |
| --- | --- |
| `boys` | `tshirts-boys`, `jeans-boys`, `hoodies`, `sets` |
| `girls` | `dresses-girls`, `tops-girls` |
| `footwear-kids` | `casual-shoes-kids`, `sandals` |
| `infants` | `rompers` |
| `accessories-kids` | `caps`, `bags-kids` |

**Accessories** (parent `accessories`)

| Root slug | Children slugs |
| --- | --- |
| `accessories` | `caps`, `sunglasses`, `goggles`, `bags`, `watches` |

If your database already uses different slugs, keep yours and return them in this same 2-level shape. Tell Flutter the four audience-root slugs if they are not `womenswear` / `menswear` / `kids` / `accessories`.

Not paginated. Empty → `{ "data": [] }` (app falls back to a local tree until this is filled).

---

### 2.3 Filters bootstrap (Filters sheet + chips)

**`GET /catalog/filters`**

The app already parses this on launch. One call fills the Filters sheet.

```http
GET /catalog/filters?audience=women&lang=it
```

`audience` optional. When set, brands / sizes / colours are those that exist on that audience.

Response `200`:

```json
{
  "data": {
    "brands": [
      {
        "id": "12",
        "code": "ATELIER",
        "name": "Atelier",
        "slug": "atelier",
        "logoUrl": null,
        "websiteUrl": null
      }
    ],
    "categories": [],
    "colors": [
      { "id": "1", "code": "black", "name": "Nero", "hexCode": "#1C1C1C" },
      { "id": "2", "code": "white", "name": "Bianco", "hexCode": "#F4F4F4" },
      { "id": "3", "code": "navy", "name": "Blu navy", "hexCode": "#1E3A5F" },
      { "id": "4", "code": "beige", "name": "Beige", "hexCode": "#D6C4A8" },
      { "id": "5", "code": "grey", "name": "Grigio", "hexCode": "#9CA3AF" },
      { "id": "6", "code": "green", "name": "Verde", "hexCode": "#2F8F6B" },
      { "id": "7", "code": "blue", "name": "Blu", "hexCode": "#3B82F6" }
    ],
    "sizeSystems": [
      {
        "id": "ss_clothing",
        "code": "eu-clothing",
        "name": "Abbigliamento",
        "sizes": [
          { "id": "s_xs", "code": "XS", "label": "XS" },
          { "id": "s_s", "code": "S", "label": "S" },
          { "id": "s_m", "code": "M", "label": "M" },
          { "id": "s_l", "code": "L", "label": "L" },
          { "id": "s_xl", "code": "XL", "label": "XL" }
        ]
      },
      {
        "id": "ss_shoes",
        "code": "eu-shoes",
        "name": "Scarpe EU",
        "sizes": [
          { "id": "s_36", "code": "36", "label": "36" },
          { "id": "s_37", "code": "37", "label": "37" }
        ]
      }
    ],
    "fitProfiles": [
      { "id": "fp_regular", "code": "regular", "name": "Regular" }
    ],
    "attributes": [],
    "discountSteps": [10, 20, 30, 40, 50],
    "priceBounds": { "min": 9, "max": 249, "currency": "EUR" },
    "sortOptions": [
      { "id": "featured", "name": "In evidenza" },
      { "id": "newest", "name": "Novità" },
      { "id": "discount", "name": "Sconto" },
      { "id": "price_asc", "name": "Prezzo ↑" },
      { "id": "price_desc", "name": "Prezzo ↓" },
      { "id": "rating", "name": "Più votati" }
    ]
  }
}
```

How the Filters sheet maps this:

| Sheet row | Source | Value the grid sends |
| --- | --- | --- |
| Brand pills | `brands[]` | `brand=<slug>,<slug>` (OR) |
| Colour pills | `colors[]` | `color=<code>,<code>` (OR). `hexCode` is the swatch |
| Size pills | flatten `sizeSystems[].sizes` | `size=<code>,<code>` (OR) |
| Discount | `discountSteps` or 10/20/30/40/50 | `minDiscount=30` (single) |
| Price (own chip, not this sheet) | `priceBounds` | `minPrice` `maxPrice` inclusive EUR |

`categories` inside filters is optional (the sheet uses `/catalog/categories`). `fitProfiles` / `attributes` are reserved; the Categories tab does not show them yet.

Colour `code` is a stable English key (`black`, `navy`). `name` is translated.

---

### 2.4 Brands directory

**`GET /catalog/brands?q=&page=1&limit=50&lang=it`**

Same brand object as in filters. Used when filters.brands is empty and for a future “all brands” screen.

```json
{
  "data": [
    { "id": "12", "code": "ATELIER", "name": "Atelier", "slug": "atelier", "logoUrl": null, "websiteUrl": null }
  ]
}
```

---

### 2.5 Product grid + search (one endpoint)

**`GET /catalog/products`**

This is the **only** list and search call. Typing in the search box must hit this API (`q`). Do not filter the grid on the device.

```http
GET /catalog/products?page=1&limit=40&lang=it
  &q=giacca
  &audience=women
  &category=dresses
  &brand=atelier,dunko
  &color=black,navy
  &size=M,L
  &minPrice=10&maxPrice=80
  &minDiscount=30
  &tryOn=true
  &inStock=true
  &sort=discount
```

| Query | App state | Rule |
| --- | --- | --- |
| `q` | search field | Title, brand, tags, colour names, category names. `it` + `en`. Ignore case and accents. `bianco` = `white` |
| `audience` | chip | `women` `men` `kids` `accessories` |
| `category` | sheet slug | Root or leaf slug (section 2.2) |
| `brand` | filter slugs, comma | OR |
| `color` | filter codes, comma | OR |
| `size` | filter codes, comma | Variant in stock in that size. OR |
| `minPrice` `maxPrice` | price sheet | Inclusive, after promotion |
| `minDiscount` | filter 10–50 | `%` off vs regular price |
| `tryOn` | try-on chip | `true` = try-on ready only |
| `inStock` | always `true` from the shop | Hide OOS |
| `sort` | sort chip | see table |
| `page` `limit` | grid | `page=1`, `limit=40` first screen |
| `lang` | app locale | `it` / `en` |

All filters are **AND**. Multi `brand` / `color` / `size` are **OR inside that field**.

**Sort**

| `sort` | Meaning | App |
| --- | --- | --- |
| `featured` | Merchandised / default | Default open |
| `newest` | Newest live | Home “new” |
| `discount` | Highest % off | Discount chip **on** |
| `rating` | Rating / count | Discount chip **off** (today’s local default) |
| `price_asc` | Low → high | Home deals |
| `price_desc` | High → low | Future |

Empty `q` is a normal filtered list. Zero hits: `data: []`, `meta.total: 0`. Never 404.

Response `200` — **this object is what `CatalogProduct.fromJson` reads**, plus the extra fields the card needs to eject demo data:

```json
{
  "data": [
    {
      "id": "81",
      "code": "TEE-ESS-01",
      "slug": "essential-crew-tee",
      "name": "Essential Crew Tee",
      "shortDescription": "Soft cotton crew.",
      "isFeatured": true,
      "publishedAt": "2026-09-01T00:00:00.000Z",
      "brand": { "id": "12", "name": "Atelier", "slug": "atelier" },
      "fit": { "id": "fp_regular", "code": "regular", "name": "Regular" },
      "price": {
        "currency": "EUR",
        "min": "23.20",
        "max": "23.20",
        "regularMin": "39.00",
        "regularMax": "39.00"
      },
      "inStock": true,
      "image": { "url": "https://cdn.example.com/a.jpg", "altText": "Front" },
      "colors": [
        { "id": "2", "code": "white", "name": "Bianco", "hexCode": "#F4F4F4" }
      ],
      "audience": "women",
      "category": { "id": "42", "slug": "dresses", "name": "Vestiti" },
      "sizes": ["S", "M", "L"],
      "rating": 4.6,
      "ratingCount": 42,
      "tryOnReady": true,
      "fitReady": true,
      "wishlisted": false
    }
  ],
  "meta": { "page": 1, "limit": 40, "total": 128, "totalPages": 4 }
}
```

| Field | Required | Card |
| --- | --- | --- |
| `id` `slug` `name` | yes | Tap → `/product/{slug}` |
| `brand.name` | yes | Brand line |
| `price.min` | yes | Price. String is OK |
| `price.regularMin` | if on sale | Strike + % off = `(regular-min)/regular` |
| `image.url` | yes | Cover |
| `inStock` | yes | Badge / hide |
| `audience` | yes | Audience chip consistency |
| `category.slug` | yes | Category chip |
| `sizes` | yes | Size chips on card optional |
| `colors` | yes | Dots |
| `tryOnReady` | yes | Try-on chip + badge |
| `rating` `ratingCount` | yes | Stars |
| `wishlisted` | if JWT | Heart |

`price.min` is the shelf price after promotion. `regularMin` is MRP.

---

### 2.6 Facets (optional P1)

**`GET /catalog/products/facets`** — same query as the list, no `page` / `sort`.

```json
{
  "data": {
    "brands": [{ "id": "12", "slug": "atelier", "name": "Atelier", "count": 12 }],
    "colors": [{ "code": "black", "name": "Nero", "hexCode": "#1C1C1C", "count": 8 }],
    "sizes": [{ "code": "M", "label": "M", "count": 10 }],
    "priceBounds": { "min": 12, "max": 180, "currency": "EUR" },
    "total": 24
  }
}
```

Open the Filters sheet → refresh counts for the current audience/category/search.

---

### 2.7 Open-tab sequence

```http
GET /catalog/filters?lang=it
GET /catalog/categories?lang=it
GET /catalog/products?page=1&limit=40&inStock=true&sort=featured&lang=it
```

Women + dresses + search:

```http
GET /catalog/categories?audience=women&lang=it
GET /catalog/products?page=1&limit=40&lang=it&audience=women&category=dresses&q=bianco&inStock=true&sort=featured
```

Home “Women” tile: `/categories?audience=women` → products `audience=women&category=womenswear`.
Home search icon: `/categories?search=1` → focus the field; first keystroke calls `q=`.

---

## 3. Product details

Tap a card → **`GET /catalog/products/{slug}`** (id also accepted).

```http
GET /catalog/products/essential-crew-tee?lang=it
```

This is what `ProductDetail.fromJson` already reads. Keep this shape so PDP can eject the demo product.

```json
{
  "data": {
    "id": "81",
    "code": "TEE-ESS-01",
    "slug": "essential-crew-tee",
    "name": "Essential Crew Tee",
    "shortDescription": "Soft cotton crew.",
    "description": "Soft cotton crew neck.",
    "careInstructions": "Wash 30 °C.",
    "sizeAndFitNotes": "Regular fit.",
    "isFeatured": true,
    "publishedAt": "2026-09-01T00:00:00.000Z",
    "brand": {
      "id": "12",
      "code": "ATELIER",
      "name": "Atelier",
      "slug": "atelier",
      "logoUrl": null
    },
    "fit": { "id": "fp_regular", "code": "regular", "name": "Regular" },
    "price": {
      "currency": "EUR",
      "min": "23.20",
      "max": "29.00",
      "regularMin": "39.00",
      "regularMax": "39.00"
    },
    "inStock": true,
    "returns": { "allowed": true, "windowDays": 14 },
    "categories": [
      { "id": "41", "code": "WESTERN", "slug": "western", "name": "Abbigliamento", "children": [] }
    ],
    "attributes": [],
    "media": [
      {
        "id": "m1",
        "type": "image",
        "url": "https://cdn.example.com/a.jpg",
        "mimeType": "image/jpeg",
        "altText": "Front",
        "isPrimary": true,
        "variantId": null
      }
    ],
    "variants": [
      {
        "id": "var_01",
        "sku": "TEE-ESS-01-W-M",
        "isDefault": true,
        "size": { "id": "s_m", "code": "M", "label": "M", "system": { "code": "eu-clothing", "name": "Abbigliamento" } },
        "color": { "id": "2", "code": "white", "name": "Bianco", "hexCode": "#F4F4F4" },
        "price": { "currency": "EUR", "current": "23.20", "regular": "39.00", "onSale": true },
        "inStock": true,
        "allowsBackorder": false,
        "measurements": [
          { "code": "chest", "name": "Torace", "valueCm": "92", "isEstimated": false }
        ]
      }
    ],
    "audience": "women",
    "tryOnReady": true,
    "fitReady": true,
    "rating": 4.6,
    "ratingCount": 42,
    "wishlisted": false,
    "related": ["lst_02", "lst_03"]
  }
}
```

Unknown / draft → `404`.

| PDP UI | Field |
| --- | --- |
| Gallery | `media` where `type=image` |
| Price | `price.min` / `price.regularMin` |
| Colour chips | unique `variants[].color` |
| Size chips | unique `variants[].size` — disable when `inStock=false` |
| Add to bag / Buy now | `id` or `slug` + `variants[].color.code` + `variants[].size.code` |
| Heart | `wishlisted` |
| Try-on | `tryOnReady` |
| Description / care | `description`, `careInstructions` |
| Size notes | `sizeAndFitNotes` or `variants[].measurements` |
| Returns line | `returns.windowDays` |

### Reviews

`GET /catalog/products/{slug}/reviews?page=1&limit=20`

```json
{
  "data": [
    {
      "id": "rev_01",
      "displayName": "Ada",
      "rating": 5,
      "title": "Perfetto",
      "body": "True to size.",
      "createdAt": "2026-10-01T08:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 }
}
```

`POST /catalog/products/{slug}/reviews` JWT `{ "rating": 5, "title": "", "body": "" }`. One per user. Second → `409`.

### Wishlist

Wishlist endpoints require an authenticated account. All responses use the
standard `{ success, data, message }` envelope.

- `GET /wishlist?page=1&limit=20` — returns `{ items, pagination }`, where
  `items` are public catalog cards with `wishlisted: true`, newest saved first.
- `PUT /wishlist/{productId}` — saves a currently public product. It is
  idempotent and returns `200` with `{ productId, wishlisted: true, created }`.
- `DELETE /wishlist/{productId}` — removes that account's saved product. It is
  idempotent and returns `200` with `data: null`.

### Fit (P2)

`GET /catalog/products/{slug}/fit-recommendation?bodyProfileId=bp_01` JWT.

```json
{ "data": { "productId": "81", "recommendedSize": "M", "confidence": 91, "notes": [{ "size": "M", "label": "Migliore corrispondenza" }] } }
```

---

## 4. Cart (bag)

JWT, or `X-Guest-Session` until login.

A line is one variant (product + colour + size). Same variant again increments qty. Max **10**.

### Item

```json
{
  "id": "cit_01",
  "productId": "81",
  "slug": "essential-crew-tee",
  "variantId": "var_01",
  "brand": "Atelier",
  "title": "Essential Crew Tee",
  "colorId": "white",
  "size": "M",
  "qty": 2,
  "unitPrice": 23.2,
  "mrp": 39,
  "imageUrl": "https://cdn.example.com/a.jpg",
  "inStock": true,
  "maxQty": 4
}
```

### Calls

| Method | Path | Body | Result |
| --- | --- | --- | --- |
| GET | `/cart` | — | `200` standard response containing `{ "items": [], "summary": { "count": 0, "subtotal": 0, "currency": "EUR" } }` in `data` |
| POST | `/cart/items` | `{ "productId": "81", "colorId": "white", "size": "M", "qty": 1 }` | `201` standard response containing the updated bag in `data` |
| PATCH | `/cart/items/:id` | `{ "qty": 3 }` | `qty: 0` deletes. `200` |
| DELETE | `/cart/items/:id` | — | `200` with new summary |
| POST | `/cart/merge` | no body | After login. Send `Authorization: Bearer <access-token>` and, for native clients, `X-Guest-Token: <guest-token>`. Web clients send the HttpOnly guest cookie with `credentials: include`. |

`size` is required. Invalid input, unavailable stock, or a quantity above 10 returns a standard `422` response with `success: false`, `data: null`, and a clear message.

**Add to bag** = `POST /cart/items`, stay on PDP.
**Buy now** = do **not** write the cart. Open checkout with `source=buyNow` (section 6).

After login, call `POST /cart/merge` before fetching or changing the authenticated cart. The response is the final account cart. On success, native clients must delete their stored guest token; the API expires the web guest cookie. If an item is no longer purchasable or the combined quantity exceeds the limit or available stock, the merge fails without consuming the guest cart.

---

## 5. Addresses

JWT. Checkout step 2.

```json
{
  "id": "adr_01",
  "label": "Home",
  "fullName": "Ada Rossi",
  "phone": "+393331234567",
  "line1": "Via Roma 1",
  "line2": "",
  "city": "Milano",
  "state": "MI",
  "postalCode": "20121",
  "country": "IT",
  "isDefault": true
}
```

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/addresses` | `{ "data": [] }` if empty. Not paginated |
| POST | `/addresses` | First address becomes default |
| PATCH | `/addresses/:id` | Partial. `isDefault: true` clears the old default |
| DELETE | `/addresses/:id` | `204`. Promote newest if default deleted |

---

## 6. Checkout (bag and buy now)

JWT. The 3-step screen (items → address → payment) shows **only** numbers from `GET /checkout/quote`.

Server-owned totals:

| Rule | Value |
| --- | --- |
| VAT | 22% included. Return `vatIncluded` |
| Standard shipping | €5.90. Free when goods after discount ≥ €100 |
| Express | €9.90. Never free |
| COD fee | €3.00 only if `paymentMode=cod` |
| Promo | Server list (`REDRESS10` = 10% off goods) |
| Wallet | `GET /wallet` `{ "data": { "balance": 120, "currency": "EUR" } }` |

### Quote

```http
GET /checkout/quote?source=cart&addressId=adr_01&shippingMethod=standard&paymentMode=card&promoCode=REDRESS10
```

Buy now:

```http
GET /checkout/quote?source=buyNow&productId=81&size=M&colorId=white&qty=1&shippingMethod=express
```

```json
{
  "data": {
    "currency": "EUR",
    "source": "cart",
    "itemCount": 2,
    "items": [
      {
        "productId": "81",
        "title": "Essential Crew Tee",
        "brand": "Atelier",
        "size": "M",
        "qty": 2,
        "unitPrice": 23.2,
        "mrp": 39,
        "lineTotal": 46.4,
        "imageUrl": "https://cdn.example.com/a.jpg"
      }
    ],
    "subtotal": 46.4,
    "listTotal": 78,
    "discount": 4.64,
    "promo": { "code": "REDRESS10", "percent": 10 },
    "shippingMethod": "standard",
    "shippingFee": 5.9,
    "freeShipping": false,
    "freeShippingRemaining": 58.24,
    "codFee": 0,
    "total": 47.66,
    "vatIncluded": 8.6,
    "savings": 31.6,
    "deliveryFrom": "2026-10-14",
    "deliveryTo": "2026-10-16",
    "walletBalance": 120,
    "paymentModes": [
      { "mode": "card", "available": true },
      { "mode": "paypal", "available": true },
      { "mode": "satispay", "available": true },
      { "mode": "wallet", "available": true },
      { "mode": "cod", "available": true }
    ]
  }
}
```

`POST /checkout/promo` `{ "code": "REDRESS10", "source": "cart" }` → `200` or `422` `fields.code=invalid`.

Empty cart → `422` `fields.cart=empty`.

### Place

```json
{
  "source": "cart",
  "addressId": "adr_01",
  "shippingMethod": "standard",
  "paymentMode": "card",
  "promoCode": "REDRESS10"
}
```

Buy now: `"source": "buyNow", "items": [{ "productId": "81", "colorId": "white", "size": "M", "qty": 1 }]`. Bag unchanged.

`paymentMode`: `card` `paypal` `satispay` `wallet` `cod`. `online` = alias of `card`.

| Mode | Cart | Payment |
| --- | --- | --- |
| `card` / `paypal` / `satispay` | Keep until confirm | `201` + `payment.clientSecret`, `status=pending` |
| `cod` | Clear | `201` `payment.status=unpaid` |
| `wallet` | Clear after debit | `201` `payment.status=paid` |

```json
{
  "data": {
    "orderId": "ord_01",
    "orderNumber": "RG-20481231",
    "status": "placed",
    "paymentMode": "card",
    "total": 47.66,
    "currency": "EUR",
    "payment": {
      "id": "pmt_01",
      "status": "pending",
      "mode": "card",
      "provider": "stripe",
      "clientSecret": "pi_secret"
    }
  }
}
```

`POST /payments/:id/confirm` `{ "providerPaymentId": "pi_123" }` → `paid` and then clear cart. Failed: `200` `status=failed`, cart kept.

Stale total (> €0.05) → `409` `reason=price_changed` + `details.quote`.

---

## 7. Orders

Statuses: `placed` `confirmed` `packed` `shipped` `outForDelivery` `delivered` `cancelled`.

```json
{
  "id": "ord_01",
  "orderNumber": "RG-20481231",
  "status": "placed",
  "paymentMode": "card",
  "currency": "EUR",
  "itemCount": 2,
  "subtotal": 46.4,
  "discount": 4.64,
  "shippingFee": 5.9,
  "codFee": 0,
  "total": 47.66,
  "vatIncluded": 8.6,
  "createdAt": "2026-10-08T12:00:00.000Z",
  "lines": [
    {
      "productId": "81",
      "brand": "Atelier",
      "title": "Essential Crew Tee",
      "colorId": "white",
      "size": "M",
      "qty": 2,
      "unitPrice": 23.2,
      "imageUrl": "https://cdn.example.com/a.jpg"
    }
  ],
  "address": { "id": "adr_01", "label": "Home", "fullName": "Ada Rossi", "phone": "+393331234567", "line1": "Via Roma 1", "line2": "", "city": "Milano", "state": "MI", "postalCode": "20121", "country": "IT" },
  "shippingMethod": "standard",
  "payment": { "id": "pmt_01", "status": "paid", "mode": "card" },
  "timeline": [
    { "status": "placed", "label": "Effettuato", "at": "2026-10-08T12:00:00.000Z", "done": true }
  ],
  "actions": { "canCancel": true, "canTrack": false, "canReturn": false }
}
```

| Call | Notes |
| --- | --- |
| `GET /orders?status=active&page=1` | `active` = placed+confirmed+packed. `shipped` = shipped+outForDelivery. List omits address/timeline |
| `GET /orders/:id` | Full object. **404** if not yours — never another order |
| `GET /orders/:id/tracking` | `200` even before a carrier id (`trackingId: null`) |
| `POST /orders/:id/cancel` | `{ "reason": "changedMind", "note": "" }` only if `canCancel` |

Cancel reasons: `changedMind` `wrongSize` `tooLate` `foundCheaper` `other` (`note` required). After `shipped` → `409`.

### Returns

`POST /returns`

```json
{ "orderId": "ord_01", "productId": "81", "size": "M", "reason": "sizeFit", "note": "Too small" }
```

Reasons: `sizeFit` `quality` `notAsDescribed` `changedMind` `damaged` `other`.
Statuses: `requested` `approved` `labelReady` `inTransit` `received` `refunded` `rejected`.
`GET /returns`, `GET /returns/:id`. Window closed → `422` `reason=window_closed`.

---

## 8. Screen → API

| Screen | Calls |
| --- | --- |
| Open Categories | `GET /catalog/filters` + `GET /catalog/categories` + `GET /catalog/products` |
| Audience chip | products `audience` + `category` = audience root slug |
| Categories sheet | uses `/catalog/categories`; pick slug → products `category=` |
| Search | products `q=` (debounce 300 ms) |
| Filters apply | products `brand` `color` `size` `minDiscount` |
| Price apply | products `minPrice` `maxPrice` |
| Try-on / sort | products `tryOn=true` / `sort=discount` |
| Next page | products `page=2` |
| PDP | `GET /catalog/products/{slug}` |
| Add to bag | `POST /cart/items` |
| Bag tab | `GET /cart` + PATCH/DELETE |
| Buy now | quote + checkout `source=buyNow` |
| Checkout | `/addresses`, `/checkout/quote`, `/checkout/promo`, `POST /checkout` |
| Orders | `GET /orders`, `GET /orders/:id`, cancel, tracking, returns |

---

## 9. Build order

**P0 — eject Categories + bag + COD checkout**

1. `GET /catalog/filters` (shape in 2.3)
2. `GET /catalog/categories` (2-level tree + four audience roots)
3. `GET /catalog/products` with `q` and every filter in 2.5, `meta` pagination
4. `GET /catalog/products/{slug}` (shape in 3)
5. Cart CRUD
6. Addresses
7. Quote + `POST /checkout` for `cod` and `card`
8. `GET /orders`, `GET /orders/:id`

**P1** — facets, wishlist, promo, wallet, PayPal, Satispay, buy now, cancel, tracking

**P2** — guest merge, reviews write, fit, returns

---

## 10. Acceptance

| # | Case | Expect |
| --- | --- | --- |
| 1 | `GET /catalog/categories?audience=women` | 2-level tree, slugs unique, no home/beauty |
| 2 | `GET /catalog/products?category=womenswear` | All live women’s products |
| 3 | `category=western` | All children of that root |
| 4 | `category=dresses&audience=women` | Women’s dresses only |
| 5 | `q=bianco` and `q=white` | Same hits |
| 6 | `brand=atelier&color=black,navy` | AND across fields, OR inside color |
| 7 | `minDiscount=30` | Only ≥ 30% off |
| 8 | `tryOn=true` | Only `tryOnReady` |
| 9 | `sort=discount` | Highest % off first |
| 10 | Zero hits | `200` `data: []` `meta.total: 0` |
| 11 | Filters payload | App can paint brands, colours (`hexCode`), sizes from `sizeSystems` |
| 12 | PDP by slug | Variants drive size chips; `inStock=false` disables |
| 13 | Add to bag no size | `422` `size=required` |
| 14 | Same variant twice | One line, qty 2 |
| 15 | Quote €40 standard | shipping 5.90, VAT included not added |
| 16 | Quote €100 standard | shipping 0 |
| 17 | COD quote | `codFee` 3 |
| 18 | Buy now | `GET /cart` unchanged |
| 19 | COD place | order appears in `GET /orders` |
| 20 | `GET /orders/not-mine` | `404` |
| 21 | Cancel `changedMind` before ship | `cancelled` |
| 22 | Cancel after ship | `409` |

---

## 11. Flutter eject (what we will delete)

| Today | After these APIs |
| --- | --- |
| Demo grid when `GET /catalog/products` is empty | Real empty state |
| Local `_matchesSearch` | only `q=` |
| Local `_minDiscount` / try-on / sort on demo rows | query params above |
| Hard-coded `ShopTaxonomy` sheet | `/catalog/categories` |
| Hard-coded colour list | `/catalog/filters` `colors` |
| `sort=price_asc` on the discount chip | `sort=discount` |
| In-memory bag | `/cart` |
| Local checkout maths + fake `RG-` | `/checkout/quote` + `POST /checkout` |
| Four hardcoded orders | `/orders` |

---

## 12. Questions

1. Confirm the four audience-root slugs: `womenswear`, `menswear`, `kids`, `accessories`.
2. Card provider (`clientSecret`) for `paymentMode=card`.
3. One seller per cart in v1?
4. Guest cart is supported in P0 through the signed `X-Guest-Token`/HttpOnly guest-cookie flow and `POST /cart/merge` after login.
