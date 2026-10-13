# Redress Home Content Flow - Admin to Flutter

**Status:** Admin Home CMS CRUD implemented; controlled development-feed verification is next
**Last updated:** 7 October 2026  
**Owners:** Platform admin, backend, Flutter  
**Use this document for:** Admin dashboard scope, backend implementation, and Flutter handoff

## 1. Product decision

The shopper Home tab is **server curated**. A shopper never creates Home
content, and a seller cannot directly publish it.

An authorized platform administrator creates banners and other Home placements
in the Redress Admin Dashboard. The backend validates the content, schedule,
image, and destination. The Flutter app then reads only the public, safe Home
feed.

~~~text
Platform Admin
    creates draft -> previews -> publishes or schedules
                                      |
                                      v
                        Backend validates and stores placement
                                      |
                                      v
                      GET /api/v1/home/feed returns live content
                                      |
                                      v
                         Flutter renders it and handles safe targets
~~~

This is the required ownership model:

| Actor | Can do |
| --- | --- |
| Super Admin | Full Home-content access |
| Platform admin with Home permissions | Manage only the actions granted by their role |
| Seller/vendor | Cannot create, edit, or publish shopper Home content in Phase 1 |
| Flutter shopper app | Reads the public feed only; cannot see drafts, asset keys, or admin endpoints |

The owner remains Redress even when a banner promotes a vendor, brand, or
product. This protects the Home page from unapproved promotions and broken
links.

## 2. Home content lifecycle

The database uses the current home_placements record with these status rules:

| Stored status | Admin meaning | Visible in public feed? |
| --- | --- | --- |
| draft | Work in progress or awaiting review | No |
| live | Approved to be shown subject to its dates | Yes, only inside its active time window |
| archived | Retained for history; no longer usable | No |
| deleted | Soft-deleted | No |

There is no separate stored scheduled status. A record with status live and a
future startsAt is displayed in Admin as **Scheduled**, but becomes public only
when its start time arrives. A live record with an elapsed endsAt is displayed
as **Expired** and is not returned to Flutter.

~~~mermaid
stateDiagram-v2
    [*] --> Draft: Admin creates placement
    Draft --> Draft: Edit / replace creative
    Draft --> Live: Publish now
    Draft --> Live: Publish with future startsAt
    Live --> Live: Edit future-safe fields / reorder
    Live --> Archived: Unpublish or retire
    Draft --> Archived: Discard
    Archived --> Draft: Duplicate as a new campaign
    Draft --> Deleted: Delete
    Archived --> Deleted: Delete
~~~

Publishing must be an explicit action. Saving a placement must never make it
visible to shoppers.

## 3. Admin authoring flow

### A. Create a placement

1. Admin opens **Home Content** in the Admin Dashboard.
2. Admin chooses a section.
3. Admin uploads an image and sees a crop/ratio preview for that section.
4. Admin adds Italian and English content, where required.
5. Admin chooses one safe destination: product, brand, category, or catalog
   filters.
6. Admin sets sort order and an optional start/end schedule.
7. Admin saves as draft.
8. Admin previews the exact locale and mobile layout.
9. Admin publishes now or schedules it.

The backend verifies all data again on create, update, and publish. Client-side
validation is only a convenience, never the source of trust.

### B. Edit a live placement

1. Admin opens the placement from the list.
2. Admin changes copy, image, destination, schedule, or order.
3. Admin saves changes.
4. Backend revalidates the record before it remains live.
5. Flutter receives the changed content on its next Home refresh; normal cache
   visibility can take up to 60 seconds.

For a material campaign replacement, Admin should duplicate the current
placement into a draft, preview it, and publish the replacement. This leaves an
audit-friendly history and prevents an incomplete live banner.

### C. Retire a placement

Admin uses **Unpublish/Archive**, not hard delete, for completed campaigns.
Deleted placements remain soft-deleted and are never sent to the public feed.

## 4. Section and creative rules

These are the Phase 1 admin constraints. They keep the Flutter Home layout
predictable and remove the need for the app to guess image ratios.

| Section key | Flutter response field | Admin purpose | Image rule | Recommended active limit | Destination rule |
| --- | --- | --- | --- | ---: | --- |
| hero | heroBanners | Top campaign carousel | Landscape, 16:9, minimum 1440 x 810 | 1-5 | Product or catalog |
| audience | audienceTiles | Women, Men, Kids shopping entry | Portrait, 3:4, minimum 900 x 1200 | 3 | Category/catalog only |
| top_brand | topBrandTiles | Featured brand card | Square, 1:1, minimum 800 x 800 | 2-6 | Brand only |
| lookbook | lookbookCards | Editorial fashion story | Portrait, 4:5, minimum 1080 x 1350 | 2-6 | Product, brand, or catalog |
| promotion | promotions | Redress campaign / service spotlight | Landscape, 16:9, minimum 1440 x 810 | 0-3 | Product or catalog |
| offer | offerBanners | Compact promotion card | Portrait, 3:4, minimum 900 x 1200 | 0-8 | Product, brand, category, or catalog |

An image is required for every Phase 1 placement. The public API still permits
image to be null for resilience, but Admin must not publish an image-less
placement in Phase 1.

Content policy:

- Hero requires title, subtitle, CTA label, and alt text in both English and
  Italian.
- Audience requires a label/title and alt text in both languages.
- Other sections require alt text in both languages; their visual copy is
  optional only when the design supports it.
- Admin must not place price, discount calculation, or unverifiable claims in
  image-only content.
- One section may contain multiple live placements, ordered by sortOrder
  ascending.
- A new campaign must not intentionally duplicate the same section, target,
  and schedule as an existing live campaign.
- Flutter hides any empty section. It must not render fixed placeholder
  marketing cards as real campaigns.

The upload service must accept JPEG, PNG, and WebP only, normalize output to
WebP, strip metadata, store the final width/height, and reject a file that
does not meet the selected section's aspect-ratio rule. The admin request must
never accept a raw S3 storage key.

## 5. Safe destinations

Admin selects a destination with a search/select UI. The Admin Dashboard must
send IDs; it must not submit Flutter routes, URLs, or manually typed slugs.

| Admin selection | Required admin value | Public feed target returned to Flutter |
| --- | --- | --- |
| Product | targetProductId | type: product, with product slug |
| Brand | targetBrandId | type: catalog, with brand filter |
| Category | targetCategoryId | type: catalog, with category filter |
| Catalog | targetFilters | type: catalog, with allow-listed filters |

Exactly one destination type is allowed per placement. At publish time, the
backend must reject a product that is not published, approved, and public; a
brand or category that is inactive; or invalid catalog filters.

Only these catalog filters are allowed in targetFilters:

| Key | Accepted value |
| --- | --- |
| category | one category slug |
| brand, color, size, fit | list of valid values |
| minPrice, maxPrice | decimal price strings |
| featured, inStock | boolean |
| sort | featured, newest, price_asc, price_desc, or name_asc |

No external URL, arbitrary mobile path, campaign identifier, or client-created
navigation type is allowed in Phase 1.

## 6. Implemented Admin API contract

The following routes are implemented. All use the project response shape:

~~~json
{
  "success": true,
  "data": {},
  "message": "Operation completed successfully."
}
~~~

| Method | Planned path | Permission | Purpose |
| --- | --- | --- | --- |
| GET | /api/v1/admin/home/placements | platform.home_content.view | Paginated list with filters for section, status, and date |
| POST | /api/v1/admin/home/placements | platform.home_content.create | Create a draft; accepts multipart image and placement fields |
| GET | /api/v1/admin/home/placements/:id | platform.home_content.view | One admin placement, including schedule and current asset preview |
| PATCH | /api/v1/admin/home/placements/:id | platform.home_content.update | Update a draft or live placement; optional replacement image |
| POST | /api/v1/admin/home/placements/:id/publish | platform.home_content.publish | Validate and set status to live |
| POST | /api/v1/admin/home/placements/:id/archive | platform.home_content.publish | Remove it from the public feed without deleting it |
| DELETE | /api/v1/admin/home/placements/:id | platform.home_content.delete | Soft-delete an eligible placement |

All routes require a valid admin access token. The permission middleware must
return the standard Redress error envelope; it must not expose internal
permission or session details.

The initial request body may be multipart/form-data because image and fields
are saved together. The image field is named image. The non-file payload uses
the same fields as the current home_placements model:

~~~text
sectionKey
targetType
targetProductId | targetBrandId | targetCategoryId | targetFilters
titleEn, titleIt
subtitleEn, subtitleIt
ctaLabelEn, ctaLabelIt
altTextEn, altTextIt
startsAt, endsAt
sortOrder
image
~~~

Create always sets draft status. The publish endpoint is the only route allowed
to make a placement public.

## 7. Required backend additions before implementation

The public Home-feed migration and endpoint already exist. The Admin module
has completed the additions below:

1. Add five platform permissions:

   - platform.home_content.view
   - platform.home_content.create
   - platform.home_content.update
   - platform.home_content.publish
   - platform.home_content.delete

2. Add audit columns through a new migration:

   - created_by_account_id
   - updated_by_account_id
   - published_by_account_id
   - published_at

3. Add the admin Home routes, validation, controller, service, repository, and
   tests.
4. Add section-aware Home image upload/optimization. It must use the existing
   S3 integration but a dedicated Home asset key namespace.
5. Add OpenAPI coverage for every admin route and the public Home response.
6. Seed only controlled development/demo placements after the database
   connection is restored. Do not create production content from a demo seed.

Items 1-5 are complete. Item 6 is the current next delivery task.

The development database is connected, the Home migrations are applied, and
the Home-content permission seeder has run. No environment value was changed.

## 8. Flutter shopper handoff

Flutter consumes only this implemented endpoint:

~~~http
GET /api/v1/home/feed?lang=en
~~~

The current, implemented Flutter response mapping is documented in
[home-flutter-handoff.md](./home-flutter-handoff.md). Flutter does not call an
admin endpoint and does not receive a placement's stored status, schedule,
target ID, or asset storage key.

### Shopper Home sequence

~~~mermaid
sequenceDiagram
    participant App as Flutter Home
    participant Feed as Public Home API
    participant Catalog as Catalog API

    App->>Feed: GET /home/feed?lang=en
    Feed-->>App: Live placements + product rails
    App->>App: Hide empty placement sections
    App->>App: Render product rails independently

    alt Shopper taps product target
        App->>Catalog: GET /catalog/products/:slug
        Catalog-->>App: Product details
    else Shopper taps catalog target
        App->>App: Open Categories with returned filters
        App->>Catalog: GET /catalog/products with allowed filters
        Catalog-->>App: Filtered product list
    end
~~~

### Flutter rendering rules

| Home UI | Feed field | Flutter behavior |
| --- | --- | --- |
| Hero carousel | heroBanners | Hide when empty; render in API order |
| Shop by audience | audienceTiles | Hide when empty; each target opens filtered Catalog |
| Brand rail | topBrandTiles | Hide when empty; each target opens filtered Catalog |
| Lookbook | lookbookCards | Hide when empty; use typed target |
| Promotion | promotions | Hide when empty; use typed target |
| Offer rail | offerBanners | Hide when empty; use typed target |
| Featured products | productRails key=featured | Reuse the public catalog product card |
| New arrivals | productRails key=new_arrivals | Reuse the public catalog product card |

Flutter must:

- show shimmer while the initial feed request is loading;
- show a retry/error state if the request fails;
- preserve the last successfully rendered feed while a refresh is in progress;
- treat empty arrays as valid content, not an error;
- use image width/height for the selected section layout;
- refresh instead of permanently storing signed image URLs;
- navigate only from the returned target object;
- hide AI picks, Style Studio, try-on picks, wishlist count, notification
  count, and delivery data until a separate approved API contract implements
  them.

The app's static chrome may still show its logo and search action. Search opens
the Catalog search experience; it is not a Home placement.

## 9. Publish-to-mobile verification

Before a campaign is considered complete, Admin/QA verifies this sequence:

1. Create a draft with both locales, a valid image, destination, schedule, and
   sort order.
2. Preview English and Italian in the Admin Dashboard.
3. Publish the placement.
4. Call GET /api/v1/home/feed in both languages and verify it appears only in
   its expected section.
5. Verify the returned target opens the correct product or filtered Catalog
   screen in Flutter.
6. Verify scheduled, archived, expired, invalid, inactive-target, and
   image-less placements do not appear.
7. Verify the mobile layout at the section's intended image ratio.

## 10. Delivery order

| Order | Backend/admin delivery | Flutter delivery |
| ---: | --- | --- |
| 1 | Restore development database connectivity and run pending migrations | None | Complete |
| 2 | Add Home-content permissions and audit migration | None | Complete |
| 3 | Implement image validation/upload and Admin placement CRUD | Admin form/list/preview | Complete |
| 4 | Implement publish/archive validation, scheduling, ordering, and tests | Consume stable Home feed | Complete |
| 5 | Seed development placements and test public feed end-to-end | Replace local demo banners/rails | In progress |
| 6 | Add richer personalized sections only with a new approved contract | Add matching UI only after contract is released |

## 11. Acceptance criteria

This flow is complete when:

- An authorized platform admin can create a draft banner without direct
  database access.
- A non-authorized account and every seller are denied management access.
- A banner cannot be published with an invalid image, invalid target, missing
  required locale data, or invalid schedule.
- Flutter sees only live, currently eligible placements.
- Every shopper redirect is a product slug or an allow-listed catalog filter.
- Empty Home sections and expired campaigns do not break the shopper screen.
- Every new endpoint returns success, data, and message with safe professional
  error messages.

