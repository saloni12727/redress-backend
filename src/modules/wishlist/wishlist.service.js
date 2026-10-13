import { Op, UniqueConstraintError } from "sequelize";

import { Product, Vendor, WishlistItem } from "../../models/index.js";

import { getWishlistProducts } from "../catalog/catalog.service.js";

import { wishlistNotFound } from "./wishlist.error.js";

async function ensurePublicProduct(productId) {
  const product = await Product.findOne({
    attributes: ["id"],
    where: {
      id: productId,
      status: "published",
      approvalStatus: "approved",
      visibility: "public",
      publishedAt: { [Op.ne]: null },
    },
    include: [
      {
        model: Vendor,
        as: "vendor",
        attributes: [],
        required: true,
        where: {
          status: "active",
          approvalStatus: "approved",
        },
      },
    ],
  });

  if (!product) {
    throw wishlistNotFound();
  }
}

export async function listWishlist({ accountId, query, locale }) {
  const result = await getWishlistProducts(
    {
      accountId,
      page: query.page,
      limit: query.limit,
    },
    locale,
  );

  return {
    items: result.products,
    pagination: result.pagination,
  };
}

export async function addWishlistItem({ accountId, productId }) {
  await ensurePublicProduct(productId);

  const where = { accountId, productId };
  const existing = await WishlistItem.findOne({ where });

  if (existing) {
    return {
      productId: String(productId),
      wishlisted: true,
      created: false,
    };
  }

  let created = true;

  try {
    await WishlistItem.create(where);
  } catch (error) {
    if (!(error instanceof UniqueConstraintError)) {
      throw error;
    }

    created = false;
  }

  return {
    productId: String(productId),
    wishlisted: true,
    created,
  };
}

export async function removeWishlistItem({ accountId, productId }) {
  await WishlistItem.destroy({
    where: { accountId, productId },
  });
}
