# Catalog & Product API — requirements

What the **Categories tab** and the **Product page** need from the backend.
Field names follow what the app already reads; **NEW** marks additions.

Base: `https://redressbackend.cyberimpulses.com/api/v1` · public (no token) ·
`lang=en|it` on every call (all names, labels and texts translated).

Implementation status: Phases 2 through 5 cover public discovery/listing, PDP
enrichment, measurement-backed size charts, read-only reviews and analytics,
related products, conditional PDP caching, rating order, and completed-order
popularity order. Persisted try-on eligibility, review submission/moderation,
seller rating, and aspect scoring remain later features.

---

## 0. Shared rules

| Rule | Value |
|---|---|
| Envelope | `{ "success": true, "data": {}, "message": "Operation completed successfully." }` |
| Error | `{ "success": false, "data": null, "message": "The requested resource could not be found." }` + HTTP status |
| Money | strings with 2 decimals, `"49.90"`, plus `currency: "EUR"` |
| Pagination | `page` (from 1), `limit` (max 50) → `data.pagination: { page, limit, total, totalPages }` |
| Ids | `id` numeric string, `slug` for URLs, `code` stable machine key |
| Lists | multi-value params are comma separated: `brand=zara,mango` |
| Empty | return `[]`, never `null`; omit unknown optional fields or send `null` |

All shopper-catalog queries expose only products that are **published**,
**approved**, and **public**, with a non-null `publishedAt`; draft, rejected,
hidden, archived, deleted, or inactive-vendor products must never leak.
Pagination is nested in `data.pagination` so every response retains the standard
`success`, `data`, and `message` envelope.

---

## 1. Category tree (3 levels)

`GET /catalog/categories?lang=it`

Root → subcategory → child. Roots are the audience chips (Women, Men, Kids,
Accessories).

```json
{
  "success": true,
  "data": {
    "items": [
    {
      "id": "1", "code": "WOMENSWEAR", "slug": "womenswear", "name": "Donna",
      "level": 1, "imageUrl": null, "iconUrl": null,
      "productCount": 820,
      "children": [
        {
          "id": "12", "code": "W_DRESSES", "slug": "women-dresses", "name": "Abiti",
          "level": 2, "imageUrl": "…", "productCount": 140,
          "children": [
            { "id": "121", "code": "W_DRESS_MIDI", "slug": "women-dresses-midi",
              "name": "Midi", "level": 3, "productCount": 38, "children": [] }
          ]
        }
      ]
    }
  ]
}
```

- **NEW** `level`, `productCount` (live, in-stock products incl. descendants).
- Hide categories with `productCount = 0`. Order = merchandising order.
- `slug` is unique across the whole tree (the app sends only the slug).

---

## 2. Brands

`GET /catalog/brands?lang=it&category=women-dresses&q=za`

| Param | Note |
|---|---|
| `category` | optional, only brands that have products there |
| `q` | optional name search |

```json
{ "data": [
  { "id": "7", "code": "ZARA", "slug": "zara", "name": "Zara",
    "logoUrl": "https://…", "productCount": 54 }
] }
```

---

## 3. Filters (facets) — built by backend

`GET /catalog/filters?lang=it&category=women-dresses&brand=zara&…`

Accepts **the same filter params as §4** and returns only options that still
give results, with counts. The app calls it again whenever a filter changes.

```json
{
  "data": {
    "brands":  [ { "slug": "zara", "name": "Zara", "count": 54 } ],
    "colors":  [ { "code": "BLACK", "name": "Nero", "hexCode": "#1C1C1C", "count": 31 } ],
    "sizes": [
      { "system": "ALPHA", "label": "Abbigliamento",
        "sizes": [ { "code": "S", "label": "S", "count": 40 },
                   { "code": "M", "label": "M", "count": 44 } ] },
      { "system": "EU_SHOE", "label": "Scarpe EU",
        "sizes": [ { "code": "38", "label": "38", "count": 12 } ] }
    ],
    "priceBounds": { "min": "9.90", "max": "289.00", "currency": "EUR" },
    "priceRanges": [
      { "id": "u25",    "label": "Sotto 25 €",  "min": null,    "max": "25.00", "count": 18 },
      { "id": "25-50",  "label": "25 € – 50 €", "min": "25.00", "max": "50.00", "count": 40 },
      { "id": "o100",   "label": "Oltre 100 €", "min": "100.00","max": null,    "count": 9 }
    ],
    "discountRanges": [
      { "id": "d10", "label": "10% e più", "minPercent": 10, "count": 35 },
      { "id": "d30", "label": "30% e più", "minPercent": 30, "count": 12 },
      { "id": "d50", "label": "50% e più", "minPercent": 50, "count": 4 }
    ],
    "flags": [
      { "code": "onSale", "label": "In saldo",       "count": 35 },
      { "code": "inStock","label": "Disponibile",    "count": 140 }
    ],
    "sorts": [
      { "code": "featured",   "label": "In evidenza" },
      { "code": "newest",     "label": "Novità" },
      { "code": "price_asc",  "label": "Prezzo crescente" },
      { "code": "price_desc", "label": "Prezzo decrescente" },
      { "code": "discount",   "label": "Sconto migliore" },
      { "code": "rating",     "label": "Più votati" },
      { "code": "popular",    "label": "Più venduti" }
    ]
  }
}
```

- **NEW** `count` on every option, `priceBounds`, `priceRanges`,
  `discountRanges`, `flags`, `sorts` (labels translated, order = display order).
- The slider uses `priceBounds`; chips use `priceRanges`.

---

## 4. Product list (grid + search + pagination)

`GET /catalog/products`

| Param | Example | Meaning |
|---|---|---|
| `category` | `women-dresses` | slug at **any level**, includes all descendants |
| `q` | `abito nero` | search name, brand, category, colour, tags (typo tolerant if possible) |
| `brand` | `zara,mango` | brand slugs (OR) |
| `color` | `BLACK,NAVY` | colour codes (OR) |
| `size` | `S,M` | size codes (OR), only variants **in stock** |
| `minPrice` / `maxPrice` | `25.00` / `50.00` | on the current (sale) price |
| `minDiscount` | `30` | **NEW** % off ≥ value |
| `tryOn` | `true` | **NEW** try-on ready only; returns no products until product eligibility is persisted |
| `audience` | `women` | optional root-audience shortcut: `women · men · kids · accessories` |
| `onSale` | `true` | **NEW** discounted only |
| `inStock` | `true` | default `true` |
| `sort` | `discount` | `featured · newest · price_asc · price_desc · discount · rating · popular` |
| `page`, `limit` | `1`, `20` | pagination |
| `lang` | `it` | |

Different params combine with **AND**. Unknown values → 422 `INVALID_FILTER`.

```json
{
  "success": true,
  "data": [
    {
      "id": "501", "code": "ZR-DRS-001", "slug": "zara-midi-dress-black",
      "name": "Abito midi in satin",
      "brand": { "id": "7", "slug": "zara", "name": "Zara", "logoUrl": "…" },
      "vendor": { "id": "22", "slug": "atelier-rossi", "name": "Atelier Rossi", "logoUrl": "…" },
      "image": { "url": "https://…", "altText": "…" },
      "hoverImage": { "url": "https://…" },
      "price": { "currency": "EUR", "min": "39.90", "max": "39.90",
                 "regularMin": "59.90", "regularMax": "59.90" },
      "discountPercent": 33,
      "rating": { "average": null, "count": 0 },
      "colors": [ { "code": "BLACK", "name": "Nero", "hexCode": "#1C1C1C" } ],
      "badges": [ { "code": "NEW", "label": "Novità" } ],
      "tryOnReady": false,
      "fitReady": true,
      "isFeatured": false,
      "inStock": true,
      "lowStock": false
    }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 143, "totalPages": 8 }
  },
  "message": "Products retrieved successfully."
}
```

- **NEW** `discountPercent`, `rating`, `tryOnReady`, `badges`, `hoverImage`,
  `lowStock`, `fitReady`, and the public `vendor` block.
- `total` is the full result count (shown as "143 products").
- Same order on every page (stable sort, tie-break by `id`).

---

## 5. Product details — one call for the whole page

`GET /catalog/products/{slug}?lang=it` → 404 if missing or not shopper-visible.

**Rule:** everything visible when the page opens comes in this **one** response
(product, variants, size chart, rating + review analytics, 3 top reviews,
related products). Only lists that grow without limit get their own
paginated call (all reviews, §8).

| In the details response | Separate call |
|---|---|
| product info, variants, photos | — |
| size chart | — |
| rating + review analytics | — |
| 3 top reviews (preview) | full list → §8 |
| related products (first 10 per group) | "See all" → §4 list |

```json
{
  "success": true,
  "data": {
    "product": {
      "id": "501", "code": "ZR-DRS-001", "slug": "zara-midi-dress-black",
      "name": "Abito midi in satin",
      "brand": { "id": "7", "slug": "zara", "name": "Zara", "logoUrl": "…" },
      "vendor": { "id": "22", "slug": "atelier-rossi", "name": "Atelier Rossi", "logoUrl": "…" },
      "breadcrumbs": [
        { "slug": "womenswear", "name": "Donna" },
        { "slug": "women-dresses", "name": "Abiti" },
        { "slug": "women-dresses-midi", "name": "Midi" }
      ],
      "shortDescription": "…",
      "description": "…",
      "highlights": ["Satin fluido", "Spacco laterale"],
      "attributes": [
        { "code": "MATERIAL", "name": "Materiale", "value": "100% poliestere" },
        { "code": "PATTERN",  "name": "Fantasia",  "value": "Tinta unita" }
      ],
      "careInstructions": "Lavaggio a mano 30°",
      "sizeAndFitNotes": "Vestibilità regolare",
      "modelInfo": { "heightCm": 176, "wearsSize": "S" },

      "price": { "currency": "EUR", "min": "39.90", "max": "39.90",
                 "regularMin": "59.90", "regularMax": "59.90" },
      "discountPercent": 33,
      "inStock": true,
      "tryOnReady": false,
      "fitReady": true,
      "fit": { "id": "3", "code": "REGULAR", "name": "Regolare" },

      "colors": [
        { "code": "BLACK", "name": "Nero", "hexCode": "#1C1C1C", "inStock": true }
      ],
      "media": [
        { "id": "9", "type": "image", "url": "https://…", "altText": "…",
          "width": 1200, "height": 1600, "isPrimary": true, "colorCode": "BLACK" }
      ],
      "variants": [
        {
          "id": "8801", "sku": "ZR-DRS-001-BLK-S", "isDefault": true,
          "color": { "code": "BLACK", "name": "Nero", "hexCode": "#1C1C1C" },
          "size": { "system": "ALPHA", "code": "S", "label": "S" },
          "price": { "currency": "EUR", "current": "39.90", "regular": "59.90",
                     "onSale": true, "discountPercent": 33 },
          "inStock": true, "lowStock": true, "maxQty": 3
        }
      ],
      "delivery": { "minDays": 2, "maxDays": 4, "freeFrom": "49.00", "codAvailable": true },
      "returns": { "allowed": true, "windowDays": 14, "text": "Reso entro 14 giorni" },
      "shareUrl": "https://redress.app/p/zara-midi-dress-black"
    },

    "sizeChart": { "…": "§6" },
    "reviews": null,
    "related": { "similar": [], "sameBrand": [], "completeLook": [], "seeAll": {} }
  },
  "message": "Product retrieved successfully."
}
```

- **NEW** `breadcrumbs`, `highlights`, `attributes` (name/value), `modelInfo`,
  `discountPercent`, `tryOnReady`, `colors[].inStock`, `media[].colorCode`
  (gallery changes with the colour), `fitReady`, `vendor`, `variants[].lowStock|maxQty`,
  `delivery`, `returns.text`, `shareUrl`, and the `sizeChart`, `reviews`,
  `related` blocks.
- One variant per colour × size; out-of-stock variants are still returned
  with `inStock: false` (shown crossed out).
- A block with no data is `null` (`sizeChart`) or empty (`related.similar: []`);
  the app hides that section. One block failing must not fail the whole call.

`fitReady` means the product has a configured fit profile and can participate in
Redress size-recommendation flows. `tryOnReady` stays `false` until product
eligibility is persisted; clients must not infer it from shopper profile data.

---

## 6. `sizeChart` block

```json
"sizeChart": {
  "system": "ALPHA",
  "unit": "cm",
  "columns": [
    { "code": "BUST",  "name": "Petto" },
    { "code": "WAIST", "name": "Vita" },
    { "code": "HIPS",  "name": "Fianchi" }
  ],
  "rows": [
    { "sizeCode": "S", "label": "S", "equivalents": { "IT": "40", "EU": "36", "US": "4" },
      "values": { "BUST": "84–88", "WAIST": "66–70", "HIPS": "92–96" } }
  ],
  "howToMeasure": [
    { "code": "BUST", "text": "Misura il punto più ampio del petto", "imageUrl": "…" }
  ],
  "fitTip": "Se sei tra due taglie scegli la più grande"
}
```

- Rows use the same `sizeCode` and order as `variants[].size.code`.
- Product-specific chart if the seller uploaded one, otherwise the brand +
  category chart. `null` when neither exists.

---

## 7. `reviews` block (rating + analytics + preview)

```json
"reviews": {
  "summary": {
    "average": 4.4,
    "count": 128,
    "distribution": { "5": 80, "4": 28, "3": 10, "2": 6, "1": 4 },
    "recommendPercent": 91,
    "withPhotosCount": 23,
    "fit": { "small": 12, "true": 78, "large": 10 },
    "aspects": [],
    "photos": [ { "url": "https://…", "thumbUrl": "https://…", "reviewId": "77" } ]
  },
  "top": [ { "…": "same review object as §8, max 3, most helpful first" } ]
}
```

- `fit` values are percentages (sum 100 when fit feedback exists). `photos` = latest 10.
- `aspects` is intentionally `[]` until aspect scoring is added to the
  authenticated review workflow; the app must not expect fabricated scores.
- `count = 0` → `average: null`, `top: []` (the app shows "No reviews yet").
- Same `average` / `count` as `rating` on the list cards (§4).

---

## 8. All reviews (the only extra call)

`GET /catalog/products/{slug}/reviews` — used by "See all reviews" and filters
on the reviews screen. The summary is **not** repeated here (it came in §7).

| Param | Values |
|---|---|
| `sort` | `recent` (default) · `helpful` · `rating_desc` · `rating_asc` |
| `rating` | `5` or `4,5` |
| `withPhotos` | `true` |
| `size` | size code bought |
| `page`, `limit` | pagination (limit ≤ 20) |

```json
{
  "success": true,
  "data": {
    "items": [
    {
      "id": "77", "rating": 5, "title": "Perfetto",
      "body": "Tessuto bellissimo…",
      "author": { "displayName": "Giulia R.", "avatarUrl": null },
      "createdAt": "2026-09-30T10:12:00Z",
      "verifiedPurchase": true,
      "purchased": { "sizeLabel": "S", "colorName": "Nero" },
      "fitFeedback": "true",
      "reviewerHeightCm": 168,
      "photos": [ { "url": "…", "thumbUrl": "…" } ],
      "helpfulCount": 12,
      "sellerReply": { "body": "Grazie!", "createdAt": "2026-10-01T09:00:00Z" }
    }
    ],
    "pagination": { "page": 1, "limit": 10, "total": 128, "totalPages": 13 }
  },
  "message": "Reviews retrieved successfully."
}
```

- `fitFeedback`: `small · true · large · null`. Names are shortened for privacy.
- Only published reviews are returned. A review is marked `verifiedPurchase`
  only when linked to an order item for the same product and customer;
  submission and moderation are separate authenticated workflows.

---

## 9. `related` block

```json
"related": {
  "similar":      [ { "…": "card object from §4" } ],
  "sameBrand":    [ { "…": "card object from §4" } ],
  "completeLook": [ { "…": "card object from §4" } ],
  "seeAll": {
    "similar":   { "category": "women-dresses-midi" },
    "sameBrand": { "brand": "zara" }
  }
}
```

| Group | Rule |
|---|---|
| `similar` | same primary category, within 50% of the current price, any brand |
| `sameBrand` | same brand, other products |
| `completeLook` | items that go with it (other categories), optional; `[]` until curated pairings exist |

- Max 10 per group, in stock only, never the product itself.
- "See all" opens the normal product list (§4) with the `seeAll` params —
  no extra endpoint.

---

## 10. Which screen calls what

| Moment | Calls |
|---|---|
| Open Categories tab | §1 categories, §3 filters, §4 products `page=1` |
| Change any filter / sort / search | §3 filters + §4 products `page=1` (same params) |
| Scroll to end | §4 products `page+1` |
| **Open product** | **§5 only** (one call) |
| "See all reviews" / review filters / scroll | §8 `page=1…n` |
| "See all" on a related row | §4 with `related.seeAll` params |

---

## 11. Why one details call (for the backend team)

- **Fast first screen:** one round trip on mobile data instead of 4–5; the page
  opens fully drawn with no jumping sections.
- **Consistent data:** price, stock, rating and chart come from the same moment.
- **Easy caching:** cache the whole response per `slug + lang` for 60 seconds
  with `stale-while-revalidate=300` (send `ETag`; the app sends `If-None-Match`). Stock is re-checked at
  add-to-bag and checkout anyway.
- **Light enough:** target < 150 KB JSON; related groups and the review preview
  are capped (10 and 3).
- **Build inside, not outside:** the backend can keep separate services for
  reviews, charts and recommendations and assemble them in this one endpoint.

---

## 12. Done when

- [ ] Category slugs work at levels 1, 2 and 3 and include descendants.
- [ ] §3 counts change with the other selected filters and never show 0-result options.
- [ ] `minDiscount`, `tryOn`, `onSale`, `sort=discount|rating|popular` work on §4.
- [ ] `data.pagination.total` / `totalPages` are correct for every filter combination.
- [ ] One §5 call returns product, variants, per-colour images, size chart,
      review analytics, top reviews and related products.
- [ ] Rating on list cards, §5 and §8 is the same number.
- [ ] Every label is translated with `lang=it`.
