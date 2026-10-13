import { QueryTypes } from "sequelize";

import { sequelize } from "../../config/database.js";

import { Account, Cart, CartItem } from "../../models/index.js";

import { markGuestSessionConverted } from "../guest/guest.repository.js";

import { verifyGuestToken } from "../guest/guest-token.service.js";

import { CommerceError } from "./commerce.error.js";

import {
  getCart,
  lockAndValidateCartVariant,
} from "./commerce.service.js";

function guestSessionError(reason) {
  return new CommerceError("The guest session is invalid or has expired.", {
    statusCode: 401,

    errorCode: "GUEST_SESSION_CLOSED",

    messageKey: "errorUnauthorized",

    details: {
      retryable: true,
      reason,
    },
  });
}

async function lockGuestSession({ guestToken, accountId, transaction }) {
  let claims;

  try {
    claims = verifyGuestToken(guestToken);
  } catch {
    throw guestSessionError("invalid_guest_token");
  }

  const rows = await sequelize.query(
    `
      SELECT
        session_uuid,
        token_version,
        status,
        converted_account_id,
        expires_at

      FROM guest_sessions

      WHERE session_uuid = :sessionUuid

      LIMIT 1

      FOR UPDATE
    `,
    {
      replacements: {
        sessionUuid: claims.sid,
      },

      type: QueryTypes.SELECT,

      transaction,
    },
  );

  const session = rows[0] ?? null;

  if (!session) {
    throw guestSessionError("guest_session_missing");
  }

  if (new Date(session.expires_at) <= new Date()) {
    throw guestSessionError("guest_session_expired");
  }

  if (Number(session.token_version) !== Number(claims.ver)) {
    throw guestSessionError("guest_token_replaced");
  }

  /*
   * Important for retry safety.
   *
   * Example:
   *
   * merge succeeded
   * network response lost
   * Flutter retries /cart/merge
   *
   * If this same guest was already converted
   * to the same account, return the account cart.
   */
  if (session.status === "converted") {
    if (String(session.converted_account_id) === String(accountId)) {
      return {
        guestSessionId: session.session_uuid,

        alreadyConverted: true,
      };
    }

    throw guestSessionError("guest_session_inactive");
  }

  if (session.status !== "active") {
    throw guestSessionError("guest_session_inactive");
  }

  return {
    guestSessionId: session.session_uuid,

    alreadyConverted: false,
  };
}

async function accountCartForUpdate({ accountId, transaction }) {
  /*
   * Cart rows do not exist for a first-time customer. Lock the stable
   * account row first so two guest sessions merging concurrently cannot
   * both create the account cart and race its unique constraint.
   */
  const account = await Account.findByPk(accountId, {
    transaction,

    lock: transaction.LOCK.UPDATE,
  });

  if (!account) {
    throw new CommerceError("The authenticated account could not be found.", {
      statusCode: 401,
    });
  }

  let cart = await Cart.findOne({
    where: {
      accountId,
    },

    transaction,

    lock: transaction.LOCK.UPDATE,
  });

  if (!cart) {
    cart = await Cart.create(
      {
        accountId,
        guestSessionUuid: null,
      },
      {
        transaction,
      },
    );
  }

  return cart;
}

export async function mergeGuestCart({ accountId, guestToken }) {
  if (!guestToken) {
    throw new CommerceError(
      "A guest session token is required to merge the shopping bag.",
      {
        statusCode: 422,

        details: {
          retryable: false,

          fields: {
            guestToken: "required",
          },
        },
      },
    );
  }

  const transaction = await sequelize.transaction();

  try {
    const guestSession = await lockGuestSession({
      guestToken,
      accountId,
      transaction,
    });

    /*
     * Idempotent retry.
     */
    if (guestSession.alreadyConverted) {
      await transaction.commit();

      return getCart({
        accountId,
      });
    }

    /*
     * Find/create logged-in user's cart.
     */
    const accountCart = await accountCartForUpdate({
      accountId,
      transaction,
    });

    /*
     * Find guest cart.
     */
    const guestCart = await Cart.findOne({
      where: {
        guestSessionUuid: guestSession.guestSessionId,
      },

      transaction,

      lock: transaction.LOCK.UPDATE,
    });

    if (guestCart) {
      const guestItems = await CartItem.findAll({
        where: {
          cartId: guestCart.id,
        },

        order: [["id", "ASC"]],

        transaction,

        lock: transaction.LOCK.UPDATE,
      });

      for (const guestItem of guestItems) {
        /*
         * Check whether same variant
         * is already present in account cart.
         */
        const accountItem = await CartItem.findOne({
          where: {
            cartId: accountCart.id,

            productVariantId: guestItem.productVariantId,
          },

          transaction,

          lock: transaction.LOCK.UPDATE,
        });

        /*
         * Same variant exists in both carts.
         *
         * Example:
         *
         * account = Dress M x1
         * guest   = Dress M x2
         *
         * result  = Dress M x3
         */
        if (accountItem) {
          const mergedQuantity =
            Number(accountItem.quantity) + Number(guestItem.quantity);

          await lockAndValidateCartVariant({
            productVariantId: guestItem.productVariantId,

            quantity: mergedQuantity,

            transaction,
          });

          await accountItem.update(
            {
              quantity: mergedQuantity,
            },
            {
              transaction,
            },
          );

          await guestItem.destroy({
            transaction,
          });
        } else {
          /*
           * Variant doesn't exist
           * in account cart.
           *
           * Move the guest cart item.
           */
          await lockAndValidateCartVariant({
            productVariantId: guestItem.productVariantId,

            quantity: guestItem.quantity,

            transaction,
          });

          await guestItem.update(
            {
              cartId: accountCart.id,
            },
            {
              transaction,
            },
          );
        }
      }

      /*
       * Guest cart is now empty.
       */
      await guestCart.destroy({
        transaction,
      });
    }

    /*
     * IMPORTANT:
     *
     * Only mark guest converted
     * AFTER cart merge succeeds.
     */
    await markGuestSessionConverted({
      sessionUuid: guestSession.guestSessionId,

      accountId,

      transaction,
    });

    await transaction.commit();

    /*
     * Return final authenticated cart.
     */
    return getCart({
      accountId,
    });
  } catch (error) {
    if (!transaction.finished) {
      await transaction.rollback();
    }

    throw error;
  }
}
