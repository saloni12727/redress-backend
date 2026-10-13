import { randomUUID } from "node:crypto";

import { buildMediaObjectKey } from "../../services/s3.service.js";
import {
  deleteStoredMedia,
  getMediaUrl,
  uploadProcessedImage,
} from "../../services/media/media-storage.service.js";
import {
  MediaValidationError,
  processImage,
} from "../../services/media/image-processor.service.js";
import { logger } from "../../config/logger.js";

import {
  HOME_AUDIENCE_CATEGORY_SLUGS,
  HOME_IMAGE_RULES,
  HOME_SECTION_DESTINATIONS,
} from "./admin-home.constants.js";
import { AdminHomeError, placementNotFound } from "./admin-home.error.js";
import * as repository from "./admin-home.repository.js";

const RATIO_TOLERANCE = 0.03;

function toPlain(placement) {
  return typeof placement?.get === "function"
    ? placement.get({ plain: true })
    : placement;
}

function id(value) {
  return value === null || value === undefined ? null : String(value);
}

function isoDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function effectiveStatus(placement) {
  if (placement.status !== "live") {
    return placement.status;
  }

  const now = Date.now();
  const startsAt = placement.startsAt
    ? new Date(placement.startsAt).getTime()
    : null;
  const endsAt = placement.endsAt ? new Date(placement.endsAt).getTime() : null;

  if (startsAt && startsAt > now) {
    return "scheduled";
  }

  if (endsAt && endsAt <= now) {
    return "expired";
  }

  return "live";
}

function targetDto(placement) {
  const target = {
    type: placement.targetType,
    productId: null,
    brandId: null,
    categoryId: null,
    filters: null,
  };

  if (placement.targetType === "product") {
    target.productId = id(placement.targetProductId);
  } else if (placement.targetType === "brand") {
    target.brandId = id(placement.targetBrandId);
  } else if (placement.targetType === "category") {
    target.categoryId = id(placement.targetCategoryId);
  } else if (placement.targetType === "catalog") {
    target.filters = placement.targetFilters ?? {};
  }

  return target;
}

export function placementDto(input) {
  const placement = toPlain(input);

  return {
    id: id(placement.id),
    sectionKey: placement.sectionKey,
    status: effectiveStatus(placement),
    storedStatus: placement.status,
    target: targetDto(placement),
    content: {
      titleEn: placement.titleEn ?? null,
      titleIt: placement.titleIt ?? null,
      subtitleEn: placement.subtitleEn ?? null,
      subtitleIt: placement.subtitleIt ?? null,
      ctaLabelEn: placement.ctaLabelEn ?? null,
      ctaLabelIt: placement.ctaLabelIt ?? null,
      altTextEn: placement.altTextEn ?? null,
      altTextIt: placement.altTextIt ?? null,
      badgeEn: placement.badgeEn ?? null,
      badgeIt: placement.badgeIt ?? null,
      discountLabelEn: placement.discountLabelEn ?? null,
      discountLabelIt: placement.discountLabelIt ?? null,
    },
    image: placement.imageStorageKey
      ? {
          url: getMediaUrl(placement.imageStorageKey),
          width: placement.imageWidth ?? null,
          height: placement.imageHeight ?? null,
          contentType: placement.imageContentType ?? null,
          sizeBytes: placement.imageSizeBytes ?? null,
        }
      : null,
    schedule: {
      startsAt: isoDate(placement.startsAt),
      endsAt: isoDate(placement.endsAt),
    },
    sortOrder: Number(placement.sortOrder ?? 0),
    audit: {
      createdAt: isoDate(placement.createdAt),
      updatedAt: isoDate(placement.updatedAt),
      publishedAt: isoDate(placement.publishedAt),
      createdByAccountId: id(placement.createdByAccountId),
      updatedByAccountId: id(placement.updatedByAccountId),
      publishedByAccountId: id(placement.publishedByAccountId),
    },
  };
}

function assertSchedule({ startsAt, endsAt }) {
  if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) {
    throw new AdminHomeError(
      "The end date must be later than the start date.",
      {
        code: "HOME_INVALID_SCHEDULE",
      },
    );
  }
}

function assertPublishWindow({ endsAt }) {
  if (endsAt && new Date(endsAt) <= new Date()) {
    throw new AdminHomeError(
      "The end date must be in the future before publishing.",
      {
        code: "HOME_PUBLISH_WINDOW_EXPIRED",
      },
    );
  }
}

function assertSectionDestination({ sectionKey, targetType }) {
  if (!HOME_SECTION_DESTINATIONS[sectionKey]?.has(targetType)) {
    throw new AdminHomeError(
      "This destination type is not available for the selected Home section.",
      {
        code: "HOME_DESTINATION_NOT_ALLOWED",
      },
    );
  }
}

function assertCanonicalDestination(placement) {
  const fields = {
    product: placement.targetProductId,
    brand: placement.targetBrandId,
    category: placement.targetCategoryId,
    catalog: placement.targetFilters,
  };

  const expected = fields[placement.targetType];

  if (expected === null || expected === undefined) {
    throw new AdminHomeError("A destination is required for this placement.", {
      code: "HOME_DESTINATION_REQUIRED",
    });
  }

  for (const [type, value] of Object.entries(fields)) {
    if (
      type !== placement.targetType &&
      value !== null &&
      value !== undefined
    ) {
      throw new AdminHomeError("Only one destination may be selected.", {
        code: "HOME_MULTIPLE_DESTINATIONS",
      });
    }
  }
}

async function assertTargetIsEligible(placement) {
  if (placement.targetType === "product") {
    const product = await repository.findPublishableProduct(
      placement.targetProductId,
    );

    if (!product) {
      throw new AdminHomeError(
        "The selected product is not available for Home content.",
        {
          code: "HOME_PRODUCT_NOT_ELIGIBLE",
        },
      );
    }

    return;
  }

  if (placement.targetType === "brand") {
    const brand = await repository.findActiveBrand(placement.targetBrandId);

    if (!brand) {
      throw new AdminHomeError("The selected brand is not active.", {
        code: "HOME_BRAND_NOT_ELIGIBLE",
      });
    }

    return;
  }

  if (placement.targetType === "category") {
    const category = await repository.findActiveCategory(
      placement.targetCategoryId,
    );

    if (!category) {
      throw new AdminHomeError("The selected category is not active.", {
        code: "HOME_CATEGORY_NOT_ELIGIBLE",
      });
    }

    if (
      placement.sectionKey === "audience" &&
      !HOME_AUDIENCE_CATEGORY_SLUGS.has(category.slug)
    ) {
      throw new AdminHomeError(
        "Audience placements can only target the Women, Men, or Kids categories.",
        {
          code: "HOME_AUDIENCE_CATEGORY_NOT_ALLOWED",
        },
      );
    }

    return;
  }

  const filtersAreValid = await repository.catalogFilterReferencesAreValid(
    placement.targetFilters ?? {},
  );

  if (!filtersAreValid) {
    throw new AdminHomeError(
      "One or more selected catalog filters are not available.",
      {
        code: "HOME_CATALOG_FILTER_NOT_ELIGIBLE",
      },
    );
  }
}

function assertImageMatchesSection({ sectionKey, width, height }) {
  const rule = HOME_IMAGE_RULES[sectionKey];

  if (!rule || !Number.isInteger(width) || !Number.isInteger(height)) {
    throw new AdminHomeError("A valid image is required for this placement.", {
      code: "HOME_IMAGE_REQUIRED",
    });
  }

  const actualRatio = width / height;

  const ratioWithinTolerance =
    Math.abs(actualRatio - rule.ratio) / rule.ratio <= RATIO_TOLERANCE;

  if (width < rule.width || height < rule.height || !ratioWithinTolerance) {
    throw new AdminHomeError(
      `The selected image does not meet the ${sectionKey} image requirements.`,
      {
        code: "HOME_IMAGE_DIMENSIONS_INVALID",
      },
    );
  }
}

function assertPublishReady(placement) {
  if (!placement.imageStorageKey) {
    throw new AdminHomeError("An image is required before publishing.", {
      code: "HOME_IMAGE_REQUIRED",
    });
  }

  assertImageMatchesSection({
    sectionKey: placement.sectionKey,
    width: Number(placement.imageWidth),
    height: Number(placement.imageHeight),
  });

  const requireBoth = (english, italian, label) => {
    if (!english?.trim?.() || !italian?.trim?.()) {
      throw new AdminHomeError(
        `English and Italian ${label} are required before publishing.`,
        {
          code: "HOME_LOCALIZED_CONTENT_REQUIRED",
        },
      );
    }
  };

  requireBoth(placement.altTextEn, placement.altTextIt, "alt text");

  if (placement.sectionKey === "hero") {
    requireBoth(placement.titleEn, placement.titleIt, "titles");

    requireBoth(placement.subtitleEn, placement.subtitleIt, "subtitles");

    requireBoth(placement.ctaLabelEn, placement.ctaLabelIt, "CTA labels");
  }

  if (placement.sectionKey === "audience") {
    requireBoth(placement.titleEn, placement.titleIt, "titles");
  }
}

function hasOwn(object, property) {
  return Object.prototype.hasOwnProperty.call(object, property);
}

function assertPatchTargetsMatchPlacement(patch, currentTargetType) {
  const targetFields = {
    product: "targetProductId",
    brand: "targetBrandId",
    category: "targetCategoryId",
    catalog: "targetFilters",
  };

  const targetType = patch.targetType ?? currentTargetType;

  const expectedField = targetFields[targetType];

  for (const field of Object.values(targetFields)) {
    if (
      field !== expectedField &&
      hasOwn(patch, field) &&
      patch[field] !== undefined
    ) {
      throw new AdminHomeError(
        "Only the destination that matches the placement target type may be updated.",
        {
          code: "HOME_DESTINATION_FIELD_NOT_ALLOWED",
        },
      );
    }
  }
}

function mergePlacement(current, patch) {
  const targetType = patch.targetType ?? current.targetType;

  const changesTargetType =
    patch.targetType !== undefined && patch.targetType !== current.targetType;

  const targetValue = (field) => {
    if (hasOwn(patch, field)) {
      return patch[field] ?? null;
    }

    return changesTargetType ? null : (current[field] ?? null);
  };

  return {
    sectionKey: patch.sectionKey ?? current.sectionKey,

    targetType,

    targetProductId:
      targetType === "product" ? targetValue("targetProductId") : null,

    targetBrandId: targetType === "brand" ? targetValue("targetBrandId") : null,

    targetCategoryId:
      targetType === "category" ? targetValue("targetCategoryId") : null,

    targetFilters:
      targetType === "catalog" ? targetValue("targetFilters") : null,

    titleEn: hasOwn(patch, "titleEn")
      ? patch.titleEn
      : (current.titleEn ?? null),

    titleIt: hasOwn(patch, "titleIt")
      ? patch.titleIt
      : (current.titleIt ?? null),

    subtitleEn: hasOwn(patch, "subtitleEn")
      ? patch.subtitleEn
      : (current.subtitleEn ?? null),

    subtitleIt: hasOwn(patch, "subtitleIt")
      ? patch.subtitleIt
      : (current.subtitleIt ?? null),

    ctaLabelEn: hasOwn(patch, "ctaLabelEn")
      ? patch.ctaLabelEn
      : (current.ctaLabelEn ?? null),

    ctaLabelIt: hasOwn(patch, "ctaLabelIt")
      ? patch.ctaLabelIt
      : (current.ctaLabelIt ?? null),

    altTextEn: hasOwn(patch, "altTextEn")
      ? patch.altTextEn
      : (current.altTextEn ?? null),

    altTextIt: hasOwn(patch, "altTextIt")
      ? patch.altTextIt
      : (current.altTextIt ?? null),

    badgeEn: hasOwn(patch, "badgeEn")
      ? patch.badgeEn
      : (current.badgeEn ?? null),

    badgeIt: hasOwn(patch, "badgeIt")
      ? patch.badgeIt
      : (current.badgeIt ?? null),

    discountLabelEn: hasOwn(patch, "discountLabelEn")
      ? patch.discountLabelEn
      : (current.discountLabelEn ?? null),

    discountLabelIt: hasOwn(patch, "discountLabelIt")
      ? patch.discountLabelIt
      : (current.discountLabelIt ?? null),

    startsAt: hasOwn(patch, "startsAt")
      ? patch.startsAt
      : (current.startsAt ?? null),

    endsAt: hasOwn(patch, "endsAt") ? patch.endsAt : (current.endsAt ?? null),

    sortOrder: hasOwn(patch, "sortOrder")
      ? patch.sortOrder
      : Number(current.sortOrder ?? 0),
  };
}

async function prepareImage(file, sectionKey, accountId) {
  if (!file) {
    return null;
  }

  let processed;

  try {
    processed = await processImage({
      buffer: file.buffer,
      claimedMimeType: file.claimedMimeType,
      policy: "homePlacement",
    });
  } catch (error) {
    if (error instanceof MediaValidationError) {
      throw new AdminHomeError("The image file is invalid for Home content.", {
        code: "HOME_IMAGE_INVALID",
      });
    }

    throw error;
  }

  assertImageMatchesSection({
    sectionKey,
    width: processed.width,
    height: processed.height,
  });

  const storageKey = buildMediaObjectKey({
    prefix: "home",
    segments: [sectionKey],
    mediaId: randomUUID(),
    extension: processed.extension,
  });

  const uploaded = await uploadProcessedImage({
    processedImage: processed,
    storageKey,
    cacheControl: "private, max-age=300",
    contentDisposition: "inline",
    serverSideEncryption: "AES256",
    metadata: {
      "asset-type": "home-placement",
      "section-key": sectionKey,
      "uploaded-by-account-id": String(accountId),
      width: String(processed.width),
      height: String(processed.height),
    },
  });

  return uploaded;
}

async function removeUploadedAsset(uploaded) {
  if (!uploaded?.storageKey) {
    return;
  }

  try {
    await deleteStoredMedia(uploaded.storageKey);
  } catch (error) {
    logger.error(
      {
        error,
        storageKey: uploaded.storageKey,
      },
      "Failed to compensate Home placement image upload",
    );
  }
}

function imageColumns(uploaded) {
  return {
    imageStorageKey: uploaded.storageKey,
    imageWidth: uploaded.width,
    imageHeight: uploaded.height,
    imageContentType: uploaded.contentType,
    imageSizeBytes: uploaded.sizeBytes,
  };
}

function assertPlacementIsEditable(placement) {
  if (placement.status === "archived") {
    throw new AdminHomeError(
      "Archived Home content cannot be edited. Create a new draft instead.",
      {
        statusCode: 409,
        code: "HOME_PLACEMENT_ARCHIVED",
      },
    );
  }
}

export async function listHomePlacements(filters) {
  const result = await repository.findPlacements(filters);

  return {
    items: result.rows.map(placementDto),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / filters.limit),
    },
  };
}

export async function getHomePlacement(placementId) {
  const placement = await repository.findPlacementById(placementId);

  if (!placement) {
    throw placementNotFound();
  }

  return placementDto(placement);
}

export async function createHomePlacement({ payload, file, accountId }) {
  if (!file) {
    throw new AdminHomeError(
      "An image is required to create a Home placement.",
      {
        code: "HOME_IMAGE_REQUIRED",
      },
    );
  }

  const draft = mergePlacement(
    {
      sectionKey: payload.sectionKey,
      targetType: payload.targetType,
      sortOrder: 0,
    },
    payload,
  );

  assertSchedule(draft);
  assertSectionDestination(draft);
  assertCanonicalDestination(draft);

  await assertTargetIsEligible(draft);

  const uploaded = await prepareImage(file, draft.sectionKey, accountId);

  let placement;

  try {
    placement = await repository.createPlacement({
      ...draft,
      ...imageColumns(uploaded),
      source: "admin",
      status: "draft",
      createdByAccountId: accountId,
      updatedByAccountId: accountId,
    });
  } catch (error) {
    await removeUploadedAsset(uploaded);
    throw error;
  }

  return placementDto(placement);
}

export async function updateHomePlacement({
  id: placementId,
  payload,
  file,
  accountId,
}) {
  const placement = await repository.findPlacementById(placementId);

  if (!placement) {
    throw placementNotFound();
  }

  const current = toPlain(placement);

  /* Repository implementations may mutate the provided placement object. */
  const previousImageStorageKey = current.imageStorageKey;

  assertPlacementIsEditable(current);

  assertPatchTargetsMatchPlacement(payload, current.targetType);

  const next = mergePlacement(current, payload);

  assertSchedule(next);
  assertSectionDestination(next);
  assertCanonicalDestination(next);

  await assertTargetIsEligible(next);

  /*
  |--------------------------------------------------------------------------
  | S3 replacement safety
  |--------------------------------------------------------------------------
  |
  | The existing image is never deleted before the replacement has:
  |
  | 1. Been processed successfully.
  | 2. Been uploaded successfully.
  | 3. Passed placement validation.
  | 4. Been persisted successfully in the database.
  |
  | If validation or DB persistence fails after the new upload, only the
  | newly uploaded replacement is removed.
  |
  */

  const uploaded = await prepareImage(file, next.sectionKey, accountId);

  let values;

  try {
    assertImageMatchesSection({
      sectionKey: next.sectionKey,
      width: Number(uploaded?.width ?? current.imageWidth),
      height: Number(uploaded?.height ?? current.imageHeight),
    });

    values = {
      ...next,
      ...(uploaded ? imageColumns(uploaded) : {}),
      updatedByAccountId: accountId,
    };

    if (current.status === "live") {
      assertPublishReady({
        ...current,
        ...values,
      });
    }
  } catch (error) {
    await removeUploadedAsset(uploaded);
    throw error;
  }

  let updated;

  try {
    updated = await repository.updatePlacement(placement, values);
  } catch (error) {
    await removeUploadedAsset(uploaded);
    throw error;
  }

  /*
  |--------------------------------------------------------------------------
  | Remove superseded image only after DB success
  |--------------------------------------------------------------------------
  |
  | At this point the database already points to the new image. Therefore
  | the old object can safely be removed.
  |
  | If old-image cleanup temporarily fails, the current placement is still
  | valid because the new image remains intact.
  |
  */

  if (
    uploaded &&
    previousImageStorageKey &&
    previousImageStorageKey !== uploaded.storageKey
  ) {
    try {
      await deleteStoredMedia(previousImageStorageKey);
    } catch (error) {
      logger.warn(
        {
          error,
          storageKey: previousImageStorageKey,
        },
        "Failed to remove superseded Home placement image",
      );
    }
  }

  return placementDto(updated);
}

export async function publishHomePlacement({ id: placementId, accountId }) {
  const placement = await repository.findPlacementById(placementId);

  if (!placement) {
    throw placementNotFound();
  }

  const current = toPlain(placement);

  if (current.status !== "draft") {
    throw new AdminHomeError("Only a draft Home placement can be published.", {
      statusCode: 409,
      code: "HOME_PLACEMENT_NOT_DRAFT",
    });
  }

  assertSchedule(current);

  /*
   * A future startsAt is valid and becomes "scheduled".
   * An already-passed endsAt is never publishable.
   */
  assertPublishWindow(current);

  assertSectionDestination(current);
  assertCanonicalDestination(current);
  assertPublishReady(current);

  await assertTargetIsEligible(current);

  const updated = await repository.updatePlacement(placement, {
    status: "live",
    publishedAt: new Date(),
    publishedByAccountId: accountId,
    updatedByAccountId: accountId,
  });

  return placementDto(updated);
}

export async function archiveHomePlacement({ id: placementId, accountId }) {
  const placement = await repository.findPlacementById(placementId);

  if (!placement) {
    throw placementNotFound();
  }

  const current = toPlain(placement);

  if (current.status === "archived") {
    throw new AdminHomeError("This Home placement is already archived.", {
      statusCode: 409,
      code: "HOME_PLACEMENT_ALREADY_ARCHIVED",
    });
  }

  /*
   * Archiving intentionally keeps the image.
   * Archived content remains available for
   * administrative history and inspection.
   */
  const updated = await repository.updatePlacement(placement, {
    status: "archived",
    updatedByAccountId: accountId,
  });

  return placementDto(updated);
}

export async function deleteHomePlacement({ id: placementId }) {
  const placement = await repository.findPlacementById(placementId);

  if (!placement) {
    throw placementNotFound();
  }

  const current = toPlain(placement);

  if (!new Set(["draft", "archived"]).has(current.status)) {
    throw new AdminHomeError(
      "Live Home content must be archived before it can be deleted.",
      {
        statusCode: 409,
        code: "HOME_PLACEMENT_MUST_BE_ARCHIVED",
      },
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Database first, storage cleanup second
  |--------------------------------------------------------------------------
  |
  | Never delete the S3 object before the database delete succeeds.
  | Otherwise a DB failure could leave an active placement pointing to a
  | missing image.
  |
  */

  await repository.destroyPlacement(placement);

  if (current.imageStorageKey) {
    try {
      await deleteStoredMedia(current.imageStorageKey);
    } catch (error) {
      /*
       * DB state is already safely deleted. A temporary S3 cleanup problem
       * must not recreate or corrupt the deleted placement.
       */
      logger.warn(
        {
          error,
          storageKey: current.imageStorageKey,
        },
        "Failed to remove deleted Home placement image",
      );
    }
  }
}
