import { randomUUID } from "node:crypto";

import { Op } from "sequelize";

import { sequelize } from "../../config/database.js";
import { logger } from "../../config/logger.js";
import { getImageUploadPolicy } from "../../config/media.config.js";
import { Account, BodyProfile, ShopperMedia } from "../../models/index.js";
import { resolveMediaUrlToken } from "../../services/media-url.service.js";
import {
  deleteStoredMedia,
  getMediaUrl,
  processAndUploadImage,
} from "../../services/media/media-storage.service.js";
import { MediaValidationError, processImage } from "../../services/media/image-processor.service.js";
import { buildBodyPhotoKey } from "../../services/s3.service.js";

import { bodyProfileNotFound, shopperFitError } from "./shopper-fit.error.js";

const MEASUREMENT_FIELDS = Object.freeze({
  heightCm: "heightCm",
  weightKg: "weightKg",
  shouldersCm: "shouldersCm",
  chestCm: "chestCm",
  waistCm: "waistCm",
  hipsCm: "hipsCm",
  inseamCm: "inseamCm",
  armLengthCm: "armLengthCm",
  shoeEu: "shoeEu",
  footLengthCm: "footLengthCm",
});

const PHOTO_FIELDS = Object.freeze({
  front: "frontMediaId",
  back: "backMediaId",
  left: "leftMediaId",
  right: "rightMediaId",
});

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const asId = (value) => (value === null || value === undefined ? null : String(value));
const asNumber = (value) => (value === null || value === undefined ? null : Number(value));
const iso = (value) => (value ? new Date(value).toISOString() : null);
const plain = (value) => (typeof value?.get === "function" ? value.get({ plain: true }) : value);

function rangeFields(measurements) {
  const fields = {};
  const check = (key, min, max) => {
    if (!hasOwn(measurements, key) || measurements[key] === null) return;
    const value = measurements[key];
    if (!Number.isFinite(value) || value < min || value > max) fields[key] = "range";
  };

  check("heightCm", 80, 250);
  check("weightKg", 20, 300);
  check("shoeEu", 15, 60);
  for (const key of [
    "shouldersCm",
    "chestCm",
    "waistCm",
    "hipsCm",
    "inseamCm",
    "armLengthCm",
    "footLengthCm",
  ]) {
    check(key, 1, 300);
  }
  return fields;
}

function assertMeasurementRange(measurements) {
  const fields = rangeFields(measurements);
  if (Object.keys(fields).length) {
    throw shopperFitError("One or more measurements are outside the supported range.", {
      fields,
    });
  }
}

function assertRequiredBaseMeasurements(measurements) {
  const fields = {};
  if (!hasOwn(measurements, "heightCm") || measurements.heightCm === null) {
    fields.heightCm = "required";
  }
  if (!hasOwn(measurements, "weightKg") || measurements.weightKg === null) {
    fields.weightKg = "required";
  }
  if (Object.keys(fields).length) {
    throw shopperFitError("Height and weight are required when creating a body profile.", {
      fields,
    });
  }
}

function measurementValues(measurements) {
  const result = {};
  for (const [apiField, modelField] of Object.entries(MEASUREMENT_FIELDS)) {
    if (hasOwn(measurements, apiField)) result[modelField] = measurements[apiField];
  }
  return result;
}

function photoIds(profile) {
  return Object.values(PHOTO_FIELDS)
    .map((field) => profile[field])
    .filter((value) => value !== null && value !== undefined)
    .map(String);
}

function decodeProfileCursor(cursor) {
  if (!cursor) return null;
  try {
    const payload = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    const updatedAt = new Date(payload.updatedAt);
    if (
      typeof payload.isDefault !== "boolean" ||
      !/^\d+$/.test(String(payload.id)) ||
      Number.isNaN(updatedAt.getTime())
    ) {
      throw new Error("invalid cursor");
    }
    return { isDefault: payload.isDefault, updatedAt, id: String(payload.id) };
  } catch {
    throw shopperFitError("The pagination cursor is invalid.", {
      fields: { cursor: "invalid" },
    });
  }
}

function encodeProfileCursor(profile) {
  const value = plain(profile);
  return Buffer.from(
    JSON.stringify({
      isDefault: Boolean(value.isDefault),
      updatedAt: new Date(value.updatedAt).toISOString(),
      id: String(value.id),
    }),
  ).toString("base64url");
}

function profilesAfterCursor(cursor) {
  const sameDefaultAfter = {
    [Op.or]: [
      { updatedAt: { [Op.lt]: cursor.updatedAt } },
      {
        [Op.and]: [
          { updatedAt: cursor.updatedAt },
          { id: { [Op.lt]: cursor.id } },
        ],
      },
    ],
  };
  if (cursor.isDefault) {
    return {
      [Op.or]: [
        { isDefault: false },
        { [Op.and]: [{ isDefault: true }, sameDefaultAfter] },
      ],
    };
  }
  return { [Op.and]: [{ isDefault: false }, sameDefaultAfter] };
}

function mediaDto(media) {
  return {
    id: asId(media.id),
    url: getMediaUrl(media.storageKey),
    purpose: media.purpose,
    mimeType: media.mimeType,
    width: media.width ?? null,
    height: media.height ?? null,
    bytes: media.sizeBytes ?? null,
  };
}

function profileDto(profile, mediaById = new Map()) {
  const value = plain(profile);
  const photos = {};
  for (const [angle, field] of Object.entries(PHOTO_FIELDS)) {
    const media = mediaById.get(String(value[field]));
    photos[angle] = media ? getMediaUrl(media.storageKey) : null;
  }
  const avatar = value.avatarMediaId
    ? mediaById.get(String(value.avatarMediaId))
    : null;

  return {
    id: asId(value.id),
    name: value.name,
    relation: value.relation,
    isDefault: Boolean(value.isDefault),
    sex: value.sex ?? null,
    avatarUrl: avatar ? getMediaUrl(avatar.storageKey) : null,
    photos,
    measurements: {
      heightCm: asNumber(value.heightCm),
      weightKg: asNumber(value.weightKg),
      shouldersCm: asNumber(value.shouldersCm),
      chestCm: asNumber(value.chestCm),
      waistCm: asNumber(value.waistCm),
      hipsCm: asNumber(value.hipsCm),
      inseamCm: asNumber(value.inseamCm),
      armLengthCm: asNumber(value.armLengthCm),
      shoeEu: asNumber(value.shoeEu),
      footLengthCm: asNumber(value.footLengthCm),
    },
    stylist: value.stylist ?? null,
    updatedAt: iso(value.updatedAt),
  };
}

async function mediaMapForProfiles(accountId, profiles, transaction = null) {
  const ids = [...new Set(profiles.flatMap((profile) => photoIds(plain(profile))))];
  if (!ids.length) return new Map();
  const media = await ShopperMedia.findAll({
    where: { accountId, id: { [Op.in]: ids } },
    transaction,
  });
  return new Map(media.map((item) => [String(item.id), plain(item)]));
}

async function dtoForProfile(accountId, profile, transaction = null) {
  return profileDto(profile, await mediaMapForProfiles(accountId, [profile], transaction));
}

async function ownedProfile(accountId, profileId, transaction = null, lock = false) {
  const profile = await BodyProfile.findOne({
    where: { id: profileId, accountId },
    transaction,
    ...(lock ? { lock: transaction.LOCK.UPDATE } : {}),
  });
  if (!profile) throw bodyProfileNotFound();
  return profile;
}

async function setDefault(accountId, profileId, transaction) {
  await BodyProfile.update(
    { isDefault: false },
    { where: { accountId, id: { [Op.ne]: profileId } }, transaction },
  );
  await BodyProfile.update(
    { isDefault: true },
    { where: { accountId, id: profileId }, transaction },
  );
}

async function clearFitSkip(accountId, transaction) {
  await Account.update(
    { fitSetupSkippedAt: null },
    { where: { id: accountId }, transaction },
  );
}

async function resolveOwnedBodyPhotoUrl({ accountId, url, transaction }) {
  let token;
  try {
    token = new URL(url).pathname.split("/").filter(Boolean).at(-1) ?? null;
  } catch {
    token = null;
  }
  const storageKey = resolveMediaUrlToken(token);
  if (!storageKey) return null;
  return ShopperMedia.findOne({
    where: { accountId, purpose: "bodyPhoto", storageKey },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
}

async function assertMediaUnusedElsewhere({ accountId, profileId, mediaId, transaction }) {
  const match = await BodyProfile.findOne({
    where: {
      accountId,
      id: { [Op.ne]: profileId },
      [Op.or]: Object.values(PHOTO_FIELDS).map((field) => ({ [field]: mediaId })),
    },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (match) {
    throw shopperFitError("A body photo can only be attached to one profile.", {
      fields: { photos: "invalid_media" },
    });
  }
}

async function removeMediaRecords(media, transaction) {
  for (const item of media) await item.destroy({ transaction });
}

async function deleteStorageAfterCommit(media) {
  for (const item of media) {
    await deleteStoredMedia(item.storageKey).catch((error) => {
      logger.warn(
        { accountId: String(item.accountId), mediaId: String(item.id), errorName: error?.name ?? "Error" },
        "Unable to delete detached body photo; cleanup will retry it.",
      );
    });
  }
}

export async function getFitSetup(accountId, fitSetupSkippedAt = undefined) {
  const profile = await BodyProfile.findOne({
    where: { accountId, relation: "self" },
    order: [["updatedAt", "DESC"]],
  });
  const skippedAt = fitSetupSkippedAt;
  if (!profile) {
    return { status: skippedAt ? "skipped" : "pending", selfProfileId: null, capabilities: { sizeAdviceReady: false, virtualTryOnReady: false } };
  }
  const hasBaseMeasurements = profile.heightCm !== null && profile.heightCm !== undefined && profile.weightKg !== null && profile.weightKg !== undefined;
  const hasProfilePhoto = photoIds(profile).length > 0;
  return {
    status:
      hasBaseMeasurements && hasProfilePhoto
        ? "ready"
        : skippedAt
          ? "skipped"
          : "partial",
    selfProfileId: String(profile.id),
    capabilities: { sizeAdviceReady: hasBaseMeasurements, virtualTryOnReady: hasProfilePhoto },
  };
}

export async function listBodyProfiles({ accountId, filters }) {
  const cursor = decodeProfileCursor(filters.cursor);
  const where = {
    accountId,
    ...(cursor ? { [Op.and]: [profilesAfterCursor(cursor)] } : {}),
  };
  const [queriedRows, total] = await Promise.all([
    BodyProfile.findAll({
      where,
      order: [["isDefault", "DESC"], ["updatedAt", "DESC"], ["id", "DESC"]],
      limit: filters.limit + 1,
    }),
    BodyProfile.count({ where: { accountId } }),
  ]);
  const hasMore = queriedRows.length > filters.limit;
  const rows = hasMore ? queriedRows.slice(0, filters.limit) : queriedRows;
  const mediaById = await mediaMapForProfiles(accountId, rows);
  return {
    items: rows.map((profile) => profileDto(profile, mediaById)),
    page: {
      limit: filters.limit,
      nextCursor: hasMore ? encodeProfileCursor(rows.at(-1)) : null,
      hasMore,
      total,
    },
  };
}

export async function getBodyProfile({ accountId, profileId }) {
  return dtoForProfile(accountId, await ownedProfile(accountId, profileId));
}

export async function createBodyProfile({ accountId, payload }) {
  assertRequiredBaseMeasurements(payload.measurements);
  assertMeasurementRange(payload.measurements);

  const transaction = await sequelize.transaction();
  try {
    const profileCount = await BodyProfile.count({ where: { accountId }, transaction, lock: transaction.LOCK.UPDATE });
    if (profileCount === 0 && payload.relation !== "self") {
      throw shopperFitError("The first body profile must be your own profile.", {
        fields: { relation: "self_required" },
      });
    }
    if (payload.relation === "self") {
      const existingSelf = await BodyProfile.findOne({ where: { accountId, relation: "self" }, transaction, lock: transaction.LOCK.UPDATE });
      if (existingSelf) {
        throw shopperFitError("Your body profile already exists.", {
          statusCode: 409,
          reason: "self_exists",
          details: { profileId: String(existingSelf.id) },
        });
      }
    }
    const profile = await BodyProfile.create(
      {
        accountId,
        name: payload.name,
        relation: payload.relation,
        selfOwnerKey: payload.relation === "self" ? accountId : null,
        sex: payload.sex ?? null,
        isDefault: profileCount === 0 || payload.isDefault === true,
        ...measurementValues(payload.measurements),
        stylist: payload.stylist ?? null,
      },
      { transaction },
    );
    if (profile.isDefault) await setDefault(accountId, profile.id, transaction);
    if (profile.relation === "self") await clearFitSkip(accountId, transaction);
    await transaction.commit();
    return dtoForProfile(accountId, profile);
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    if (error?.name === "SequelizeUniqueConstraintError" && payload.relation === "self") {
      const existing = await BodyProfile.findOne({ where: { accountId, relation: "self" } });
      throw shopperFitError("Your body profile already exists.", {
        statusCode: 409,
        reason: "self_exists",
        details: existing ? { profileId: String(existing.id) } : {},
      });
    }
    throw error;
  }
}

export async function upsertSelfBodyProfile({ accountId, payload }) {
  const existing = await BodyProfile.findOne({ where: { accountId, relation: "self" } });
  if (!existing) return createBodyProfile({ accountId, payload: { ...payload, relation: "self" } });
  return updateBodyProfile({ accountId, profileId: existing.id, payload: { ...payload, relation: undefined } });
}

export async function updateBodyProfile({ accountId, profileId, payload }) {
  if (payload.measurements) assertMeasurementRange(payload.measurements);

  const transaction = await sequelize.transaction();
  let detachedMedia = [];
  let result;
  try {
    const profile = await ownedProfile(accountId, profileId, transaction, true);
    if (
      payload.relation !== undefined &&
      ((profile.relation === "self" && payload.relation !== "self") ||
        (profile.relation !== "self" && payload.relation === "self"))
    ) {
      throw shopperFitError("A body profile relation cannot be changed to or from self.", {
        fields: { relation: "immutable" },
      });
    }
    const values = {};
    if (payload.name !== undefined) values.name = payload.name;
    if (payload.relation !== undefined) values.relation = payload.relation;
    if (payload.sex !== undefined) values.sex = payload.sex;
    if (payload.stylist !== undefined) values.stylist = payload.stylist;
    if (payload.measurements) Object.assign(values, measurementValues(payload.measurements));

    if (payload.photos) {
      const previousIds = photoIds(profile);
      const nextIds = new Set(previousIds);
      for (const [angle, url] of Object.entries(payload.photos)) {
        const field = PHOTO_FIELDS[angle];
        const previousId = profile[field] === null || profile[field] === undefined ? null : String(profile[field]);
        if (url === null) {
          values[field] = null;
          if (previousId) nextIds.delete(previousId);
          continue;
        }
        const media = await resolveOwnedBodyPhotoUrl({ accountId, url, transaction });
        if (!media) {
          throw shopperFitError("One or more body photos are not valid for this account.", {
            fields: { [`photos.${angle}`]: "invalid_media" },
          });
        }
        await assertMediaUnusedElsewhere({ accountId, profileId: profile.id, mediaId: media.id, transaction });
        values[field] = media.id;
        nextIds.add(String(media.id));
        await media.update({ attachedAt: new Date() }, { transaction });
        if (previousId && previousId !== String(media.id)) nextIds.delete(previousId);
      }
      const afterIds = new Set(
        Object.values(PHOTO_FIELDS)
          .map((field) => values[field] === undefined ? profile[field] : values[field])
          .filter((value) => value !== null && value !== undefined)
          .map(String),
      );
      const deleteIds = previousIds.filter((mediaId) => !afterIds.has(mediaId));
      if (deleteIds.length) {
        detachedMedia = await ShopperMedia.findAll({ where: { accountId, id: { [Op.in]: deleteIds } }, transaction, lock: transaction.LOCK.UPDATE });
        await removeMediaRecords(detachedMedia, transaction);
      }
    }

    if (Object.keys(values).length) await profile.update(values, { transaction });
    if (payload.isDefault === true) await setDefault(accountId, profile.id, transaction);
    if (profile.relation === "self") await clearFitSkip(accountId, transaction);
    await transaction.commit();
    result = await dtoForProfile(accountId, profile);
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    throw error;
  }
  await deleteStorageAfterCommit(detachedMedia);
  return result;
}

export async function deleteBodyProfile({ accountId, profileId }) {
  const transaction = await sequelize.transaction();
  let deletedMedia = [];
  try {
    const profile = await ownedProfile(accountId, profileId, transaction, true);
    const total = await BodyProfile.count({ where: { accountId }, transaction, lock: transaction.LOCK.UPDATE });
    if (total <= 1) {
      throw shopperFitError("At least one body profile must remain on the account.", { reason: "last_profile" });
    }
    if (profile.relation === "self") {
      throw shopperFitError("Your own body profile cannot be deleted while other profiles remain.", { reason: "self_required" });
    }
    deletedMedia = await ShopperMedia.findAll({ where: { accountId, id: { [Op.in]: photoIds(profile) } }, transaction, lock: transaction.LOCK.UPDATE });
    await removeMediaRecords(deletedMedia, transaction);
    const wasDefault = Boolean(profile.isDefault);
    await profile.destroy({ transaction });
    if (wasDefault) {
      let replacement = await BodyProfile.findOne({
        where: { accountId, relation: "self" },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!replacement) replacement = await BodyProfile.findOne({
        where: { accountId },
        order: [["updatedAt", "DESC"]],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (replacement) await setDefault(accountId, replacement.id, transaction);
    }
    await transaction.commit();
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    throw error;
  }
  await deleteStorageAfterCommit(deletedMedia);
}

export async function uploadBodyPhoto({ accountId, file }) {
  const storageKey = buildBodyPhotoKey(accountId, randomUUID());
  let uploaded = false;
  try {
    const stored = await processAndUploadImage({
      file,
      policyName: "bodyPhoto",
      storageKey,
      cacheControl: "private, no-store",
      contentDisposition: "inline",
      metadata: { purpose: "body-photo", accountid: String(accountId) },
      serverSideEncryption: "AES256",
    });
    uploaded = true;
    const media = await ShopperMedia.create({
      accountId,
      purpose: "bodyPhoto",
      storageKey: stored.storageKey,
      mimeType: stored.contentType,
      width: stored.width,
      height: stored.height,
      sizeBytes: stored.sizeBytes,
      attachedAt: null,
    });
    return mediaDto(plain(media));
  } catch (error) {
    if (uploaded) await deleteStoredMedia(storageKey).catch(() => undefined);
    if (error instanceof MediaValidationError) {
      throw shopperFitError("The body photo is invalid.", {
        fields: { file: error.reason },
      });
    }
    throw error;
  }
}

/* Run from the scheduled cleanup script. Unattached uploads never become
 * accessible through a profile and are removed after the documented window. */
export async function cleanupUnattachedBodyPhotos({ now = new Date() } = {}) {
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const candidates = await ShopperMedia.findAll({
    where: {
      purpose: "bodyPhoto",
      attachedAt: null,
      createdAt: { [Op.lt]: cutoff },
    },
    limit: 200,
    order: [["createdAt", "ASC"]],
  });
  let deleted = 0;
  for (const media of candidates) {
    try {
      await deleteStoredMedia(media.storageKey);
      await media.destroy();
      deleted += 1;
    } catch (error) {
      logger.warn(
        { mediaId: String(media.id), errorName: error?.name ?? "Error" },
        "Unable to clean up an unattached body photo.",
      );
    }
  }
  return { scanned: candidates.length, deleted };
}

export async function skipFitSetup({ accountId }) {
  await Account.update(
    { fitSetupSkippedAt: sequelize.literal("COALESCE(fit_setup_skipped_at, UTC_TIMESTAMP())") },
    { where: { id: accountId } },
  );
  const account = await Account.findByPk(accountId, { attributes: ["fitSetupSkippedAt"] });
  return getFitSetup(accountId, account?.fitSetupSkippedAt ?? null);
}

export async function estimateMeasurements({ fields, files }) {
  assertMeasurementRange({ heightCm: fields.heightCm, weightKg: fields.weightKg });
  const front = files?.front;
  const side = files?.side;
  const missing = {};
  if (!front) missing.front = "required";
  if (!side) missing.side = "required";
  if (Object.keys(missing).length) {
    throw shopperFitError("Both measurement photos are required.", { fields: missing });
  }
  let processedPhotos = [];
  try {
    processedPhotos.push(
      await processImage({
        buffer: front.buffer,
        claimedMimeType: front.claimedMimeType,
        policy: getImageUploadPolicy("bodyMeasurement"),
      }),
    );
    processedPhotos.push(
      await processImage({
        buffer: side.buffer,
        claimedMimeType: side.claimedMimeType,
        policy: getImageUploadPolicy("bodyMeasurement"),
      }),
    );
  } catch (error) {
    if (error instanceof MediaValidationError) {
      throw shopperFitError("One or more measurement photos are invalid.", {
        fields: { front: error.reason, side: error.reason },
      });
    }
    throw error;
  } finally {
    /* No storage, media row, queue job, filename, or measurement is retained. */
    for (const processed of processedPhotos) processed?.buffer?.fill(0);
    if (front?.buffer) front.buffer.fill(0);
    if (side?.buffer) side.buffer.fill(0);
    if (front) front.buffer = Buffer.alloc(0);
    if (side) side.buffer = Buffer.alloc(0);
  }
  throw shopperFitError("Measurement estimation is temporarily unavailable. Please enter your measurements by hand.", {
    statusCode: 503,
    reason: "estimator_unavailable",
    retryable: true,
  });
}

export async function estimateStoredBodyProfile({ accountId, profileId }) {
  const profile = await ownedProfile(accountId, profileId);
  if (!photoIds(profile).length) {
    throw shopperFitError("At least one body photo is required before estimating measurements.", {
      fields: { photos: "required" },
    });
  }
  throw shopperFitError("Measurement estimation is temporarily unavailable. Please enter your measurements by hand.", {
    statusCode: 503,
    reason: "estimator_unavailable",
    retryable: true,
  });
}
