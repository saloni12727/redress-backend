import { randomUUID } from "node:crypto";

import { buildBrandLogoKey } from "../../services/s3.service.js";
import {
  deleteStoredMedia,
  getMediaUrl,
  uploadProcessedImage,
} from "../../services/media/media-storage.service.js";
import {
  MediaValidationError,
  processImage,
} from "../../services/media/image-processor.service.js";

import { AdminBrandError, brandNotFound } from "./admin-brands.error.js";
import * as repository from "./admin-brands.repository.js";

function toPlain(value) {
  return typeof value?.get === "function" ? value.get({ plain: true }) : value;
}

function id(value) {
  return value === null || value === undefined ? null : String(value);
}

function boolean(value) {
  return value === true || value === 1 || value === "1";
}

function isoDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function brandDto(input) {
  const brand = toPlain(input);

  return {
    id: id(brand.id),
    code: brand.code,
    name: brand.name,
    slug: brand.slug,
    logoUrl: brand.logoKey ? getMediaUrl(brand.logoKey) : null,
    websiteUrl: brand.websiteUrl ?? null,
    isActive: boolean(brand.isActive),
    createdAt: isoDate(brand.createdAt),
    updatedAt: isoDate(brand.updatedAt),
  };
}

function duplicateError(field) {
  return new AdminBrandError(`The brand ${field} is already in use.`, {
    statusCode: 409,
    code: `BRAND_${field.toUpperCase()}_EXISTS`,
  });
}

function isUniqueConstraintError(error) {
  return error?.name === "SequelizeUniqueConstraintError";
}

async function assertUniqueIdentity({ code, slug, excludeId }) {
  if (code !== undefined) {
    const existing = await repository.findBrandByCode(code);

    if (existing && String(existing.id) !== String(excludeId)) {
      throw duplicateError("code");
    }
  }

  if (slug !== undefined) {
    const existing = await repository.findBrandBySlug(slug);

    if (existing && String(existing.id) !== String(excludeId)) {
      throw duplicateError("slug");
    }
  }
}

async function prepareLogo(file) {
  if (!file) {
    return null;
  }

  try {
    return await processImage({
      buffer: file.buffer,
      claimedMimeType: file.claimedMimeType,
      policy: "brandLogo",
    });
  } catch (error) {
    if (error instanceof MediaValidationError) {
      throw new AdminBrandError("The brand logo image is invalid.", {
        code: "BRAND_LOGO_INVALID",
      });
    }

    throw error;
  }
}

async function uploadLogo(processedImage, brandId) {
  if (!processedImage) {
    return null;
  }

  const storageKey = buildBrandLogoKey(brandId, randomUUID());

  return uploadProcessedImage({
    processedImage,
    storageKey,
    cacheControl: "private, max-age=300",
    contentDisposition: "inline",
    serverSideEncryption: "AES256",
    metadata: {
      "asset-type": "brand-logo",
      "brand-id": String(brandId),
    },
  });
}

async function removeUploadedLogo(uploaded) {
  if (uploaded?.storageKey) {
    await deleteStoredMedia(uploaded.storageKey);
  }
}

function brandValues(payload) {
  const values = {};

  for (const field of ["code", "name", "slug", "websiteUrl", "isActive"]) {
    if (Object.hasOwn(payload, field)) {
      values[field] = payload[field];
    }
  }

  return values;
}

export async function listAdminBrands(filters) {
  const result = await repository.findBrands(filters);

  return {
    items: result.rows.map(brandDto),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total: result.total,
      totalPages: result.total === 0 ? 0 : Math.ceil(result.total / filters.limit),
    },
  };
}

export async function getAdminBrand(brandId) {
  const brand = await repository.findBrandById(brandId);

  if (!brand) {
    throw brandNotFound();
  }

  return brandDto(brand);
}

export async function createAdminBrand({ payload, file }) {
  const processedLogo = await prepareLogo(file);
  let brand;
  let uploadedLogo;

  try {
    await assertUniqueIdentity({ code: payload.code, slug: payload.slug });

    brand = await repository.createBrand({
      ...brandValues(payload),
      isActive: payload.isActive ?? true,
    });

    uploadedLogo = await uploadLogo(processedLogo, brand.id);

    if (uploadedLogo) {
      await repository.updateBrand(brand, {
        logoKey: uploadedLogo.storageKey,
      });
    }

    return brandDto(brand);
  } catch (error) {
    try {
      await removeUploadedLogo(uploadedLogo);
    } catch {
      // The original error is the actionable one; cleanup is best effort.
    }

    if (brand) {
      try {
        await repository.destroyBrand(brand, { force: true });
      } catch {
        // Keep the original failure and never expose persistence details.
      }
    }

    if (isUniqueConstraintError(error)) {
      throw new AdminBrandError(
        "A brand with the same code or slug already exists.",
        {
          statusCode: 409,
          code: "BRAND_IDENTITY_EXISTS",
        },
      );
    }

    throw error;
  }
}

export async function updateAdminBrand({ id: brandId, payload, file }) {
  const brand = await repository.findBrandById(brandId);

  if (!brand) {
    throw brandNotFound();
  }

  const processedLogo = await prepareLogo(file);
  let uploadedLogo;

  try {
    await assertUniqueIdentity({
      code: payload.code,
      slug: payload.slug,
      excludeId: brandId,
    });

    uploadedLogo = await uploadLogo(processedLogo, brand.id);

    const values = brandValues(payload);

    if (uploadedLogo) {
      values.logoKey = uploadedLogo.storageKey;
    }

    const previousLogoKey = brand.logoKey;
    const updated = await repository.updateBrand(brand, values);

    if (uploadedLogo && previousLogoKey !== uploadedLogo.storageKey) {
      try {
        await deleteStoredMedia(previousLogoKey);
      } catch {
        // The database already references the replacement logo safely.
      }
    }

    return brandDto(updated);
  } catch (error) {
    try {
      await removeUploadedLogo(uploadedLogo);
    } catch {
      // Preserve the original error.
    }

    if (isUniqueConstraintError(error)) {
      throw new AdminBrandError(
        "A brand with the same code or slug already exists.",
        {
          statusCode: 409,
          code: "BRAND_IDENTITY_EXISTS",
        },
      );
    }

    throw error;
  }
}

export async function deleteAdminBrand(brandId) {
  const brand = await repository.findBrandById(brandId);

  if (!brand) {
    throw brandNotFound();
  }

  const dependencies = await repository.findBrandDependencies(brandId);

  if (Object.values(dependencies).some((count) => count > 0)) {
    throw new AdminBrandError(
      "This brand cannot be deleted while it is used by products or Home placements.",
      {
        statusCode: 409,
        code: "BRAND_HAS_DEPENDENCIES",
      },
    );
  }

  const logoKey = brand.logoKey;
  await repository.destroyBrand(brand);

  if (logoKey) {
    try {
      await deleteStoredMedia(logoKey);
    } catch {
      // The soft-deleted brand is already safely unavailable to clients.
    }
  }
}
