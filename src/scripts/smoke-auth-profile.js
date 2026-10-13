import sharp from "sharp";
import { QueryTypes } from "sequelize";

import {
  connectDatabase,
  disconnectDatabase,
  sequelize,
} from "../config/database.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { deleteFromS3 } from "../services/s3.service.js";

if (env.NODE_ENV === "production") {
  throw new Error("The auth/profile smoke test cannot run in production.");
}

if (!env.AUTH_OTP_FIXED_CODE) {
  throw new Error("AUTH_OTP_FIXED_CODE is required for this smoke test.");
}

const uniquePart = `${Date.now()}-${process.pid}`;
const initialEmail = `codex-smoke-${uniquePart}@example.test`;
const changedEmail = `codex-smoke-changed-${uniquePart}@example.test`;
const phone = `+393${String(Date.now()).slice(-9)}`;
const password = "C0dX!P7vK9";
const apiBase = `http://127.0.0.1:${env.PORT}${env.API_PREFIX}`;

let accountId = null;
let accessToken = null;
let refreshToken = null;
let report = null;

async function request(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, options);
  const body = response.status === 204 ? null : await response.json();

  if (!response.ok) {
    throw new Error(
      `${options.method ?? "GET"} ${path} failed with ${response.status}: ${JSON.stringify(body)}`,
    );
  }

  return { response, body };
}

function jsonOptions(method, body, authenticated = false) {
  return {
    method,
    headers: {
      "content-type": "application/json",
      ...(authenticated ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  };
}

async function cleanup() {
  await connectDatabase();

  try {
    if (accountId) {
      const rows = await sequelize.query(
        `
          SELECT profile_photo_storage_key
          FROM accounts
          WHERE id = :accountId
          LIMIT 1
        `,
        {
          replacements: { accountId },
          type: QueryTypes.SELECT,
        },
      );

      const orphanedPhotoKey = rows[0]?.profile_photo_storage_key;

      if (orphanedPhotoKey) {
        try {
          await deleteFromS3(orphanedPhotoKey);
        } catch (error) {
          logger.error(
            {
              accountId: String(accountId),
              storageKey: orphanedPhotoKey,
              errorName: error?.name ?? "Error",
            },
            "Smoke-test profile photo cleanup failed",
          );
        }
      }

      await sequelize.query("DELETE FROM accounts WHERE id = :accountId", {
        replacements: { accountId },
      });
    }

    await sequelize.query(
      `
        DELETE FROM auth_otp_challenges
        WHERE destination IN (:initialEmail, :changedEmail, :phone)
      `,
      {
        replacements: { initialEmail, changedEmail, phone },
      },
    );
  } finally {
    await disconnectDatabase();
  }
}

try {
  const otpSend = await request(
    "/auth/otp/send",
    jsonOptions("POST", {
      purpose: "auth",
      channel: "email",
      email: initialEmail,
    }),
  );

  const otpVerify = await request(
    "/auth/otp/verify",
    jsonOptions("POST", {
      channel: "email",
      email: initialEmail,
      otp: env.AUTH_OTP_FIXED_CODE,
      deviceType: "smoke-test",
    }),
  );

  const signup = await request(
    "/auth/signup",
    jsonOptions("POST", {
      signupToken: otpVerify.body.data.signupToken,
      fullName: "Codex Smoke User",
      password,
      deviceType: "smoke-test",
      deviceName: "Auth profile smoke",
    }),
  );

  accountId = signup.body.data.user.id;
  accessToken = signup.body.data.accessToken;
  refreshToken = signup.body.data.refreshToken;

  await request(
    "/auth/logout",
    jsonOptions("POST", { refreshToken }, true),
  );

  const login = await request(
    "/auth/login",
    jsonOptions("POST", {
      email: initialEmail,
      password,
      deviceType: "smoke-test",
      deviceName: "Auth profile smoke",
    }),
  );

  accessToken = login.body.data.accessToken;
  refreshToken = login.body.data.refreshToken;

  const authHeaders = { authorization: `Bearer ${accessToken}` };
  const profile = await request("/auth/me", { headers: authHeaders });

  const updatedProfile = await request(
    "/auth/me",
    jsonOptions(
      "PATCH",
      {
        firstName: "Codex",
        lastName: "Smoke",
        locale: "en",
      },
      true,
    ),
  );

  const inputPhoto = await sharp({
    create: {
      width: 256,
      height: 256,
      channels: 3,
      background: "#7f1d1d",
    },
  })
    .jpeg()
    .toBuffer();

  const uploadedPhoto = await request("/auth/me/photo", {
    method: "PUT",
    headers: {
      ...authHeaders,
      "content-type": "image/jpeg",
    },
    body: inputPhoto,
  });

  const proxiedPhoto = await fetch(uploadedPhoto.body.data.photoUrl);

  if (
    !proxiedPhoto.ok ||
    proxiedPhoto.headers.get("content-type") !== "image/webp"
  ) {
    throw new Error(
      `Media proxy photo check failed with ${proxiedPhoto.status} ${proxiedPhoto.headers.get("content-type")}`,
    );
  }

  const emailRequest = await request(
    "/auth/email/change/request",
    jsonOptions("POST", { newEmail: changedEmail }, true),
  );
  const emailVerify = await request(
    "/auth/email/change/verify",
    jsonOptions(
      "POST",
      { newEmail: changedEmail, otp: env.AUTH_OTP_FIXED_CODE },
      true,
    ),
  );

  const phoneRequest = await request(
    "/auth/phone/change/request",
    jsonOptions("POST", { newPhone: phone }, true),
  );
  const phoneVerify = await request(
    "/auth/phone/change/verify",
    jsonOptions(
      "POST",
      { newPhone: phone, otp: env.AUTH_OTP_FIXED_CODE },
      true,
    ),
  );

  const deletedPhoto = await request("/auth/me/photo", {
    method: "DELETE",
    headers: authHeaders,
  });
  const openApi = await request("/docs/openapi.json");

  await request(
    "/auth/logout",
    jsonOptions("POST", { refreshToken }, true),
  );

  report = {
    otpSend: otpSend.response.status,
    signup: signup.response.status,
    login: login.response.status,
    getProfile: profile.response.status,
    patchProfile: updatedProfile.response.status,
    uploadPhoto: uploadedPhoto.response.status,
    mediaProxyPhotoRead: proxiedPhoto.status,
    emailChangeRequest: emailRequest.response.status,
    emailChangeVerify: emailVerify.response.status,
    phoneChangeRequest: phoneRequest.response.status,
    phoneChangeVerify: phoneVerify.response.status,
    deletePhoto: deletedPhoto.response.status,
    photoRemoved: deletedPhoto.body.data.photoUrl === null,
    openapi: openApi.response.status,
    documentedPaths: Object.keys(openApi.body.paths).length,
  };
} finally {
  await cleanup();
}

console.log(JSON.stringify({ ...report, cleanup: "completed" }, null, 2));
