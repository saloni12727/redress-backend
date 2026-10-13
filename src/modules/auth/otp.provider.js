import { env } from "../../config/env.js";

import { getAuthConfig } from "../../config/auth.config.js";

import { getMailConfig } from "../../config/mail.config.js";

import { sendOtpEmail } from "./mail.service.js";

function getWebhookConfig(channel, config) {
  if (channel === "sms") {
    return {
      url: config.smsWebhookUrl,

      bearerToken: config.smsWebhookBearerToken,

      providerLabel: "SMS",
    };
  }

  if (channel === "email") {
    return {
      url: config.emailWebhookUrl,

      bearerToken: config.emailWebhookBearerToken,

      providerLabel: "Email",
    };
  }

  throw new Error(`Unsupported OTP channel: ${channel}`);
}

function getOtpMessageType(purpose) {
  if (purpose === "password_reset") {
    return "password_reset_otp";
  }

  if (purpose === "phone_link" || purpose === "phone_change") {
    return "phone_change_otp";
  }

  if (purpose === "email_change") {
    return "email_change_otp";
  }

  return "auth_otp";
}

export async function sendAuthOtp({
  purpose = "auth",
  channel,
  destination,
  code,
  locale,
  expiresIn,
}) {
  /*
  |--------------------------------------------------------------------------
  | Email SMTP
  |--------------------------------------------------------------------------
  |
  | Email has its own SMTP transport.
  |
  | This intentionally works even when:
  |
  | AUTH_OTP_PROVIDER=disabled
  |
  | because AUTH_OTP_PROVIDER continues to control SMS / legacy webhook
  | delivery while email can independently use SMTP.
  |
  */

  if (channel === "email") {
    const mailConfig = getMailConfig();

    if (mailConfig.enabled) {
      const delivery = await sendOtpEmail({
        to: destination,

        purpose,

        code,

        locale,

        expiresIn,
      });

      return {
        provider: "smtp",
        ...delivery,
      };
    }
  }

  const config = getAuthConfig();

  /*
   * A public email-OTP request must use an actual delivery provider. Falling
   * back to the console provider returns 202 without sending an email, which
   * is appropriate only for controlled SMS/test flows and misleading to a
   * mobile signup user.
   */
  if (channel === "email" && config.otpProvider === "console") {
    throw new Error(
      "Email OTP delivery requires SMTP or an email webhook provider.",
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Disabled
  |--------------------------------------------------------------------------
  */

  if (config.otpProvider === "disabled") {
    throw new Error(`${channel.toUpperCase()} OTP provider is not configured.`);
  }

  /*
  |--------------------------------------------------------------------------
  | Development / controlled test console
  |--------------------------------------------------------------------------
  */

  if (config.otpProvider === "console") {
    if (env.NODE_ENV === "production" && !config.allowConsoleOtpInProduction) {
      throw new Error("Console OTP provider cannot be used in production.");
    }

    process.stdout.write(
      `[TEST OTP] purpose=${purpose} channel=${channel} destination=${destination} code=${code} locale=${locale} expiresIn=${expiresIn}\n`,
    );

    return {
      provider: "console",
    };
  }

  /*
  |--------------------------------------------------------------------------
  | Webhook
  |--------------------------------------------------------------------------
  */

  if (config.otpProvider === "webhook") {
    const provider = getWebhookConfig(channel, config);

    if (!provider.url) {
      throw new Error(
        `${provider.providerLabel} OTP webhook is not configured.`,
      );
    }

    const headers = {
      "Content-Type": "application/json",
    };

    if (provider.bearerToken) {
      headers.Authorization = `Bearer ${provider.bearerToken}`;
    }

    const response = await fetch(provider.url, {
      method: "POST",

      headers,

      body: JSON.stringify({
        channel,

        to: destination,

        type: getOtpMessageType(purpose),

        purpose,

        locale,

        variables: {
          code,
          expiresIn,
        },
      }),

      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(
        `${provider.providerLabel} provider returned HTTP ${response.status}.`,
      );
    }

    return {
      provider: "webhook",
    };
  }

  throw new Error(`Unsupported OTP provider: ${config.otpProvider}`);
}
