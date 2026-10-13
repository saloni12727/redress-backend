import nodemailer from "nodemailer";

import { getMailConfig } from "../../config/mail.config.js";

let transporter = null;

function getTransporter() {
  const config = getMailConfig();

  if (!config.enabled) {
    throw new Error("Email SMTP is not configured.");
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: config.service,

      auth: {
        user: config.user,

        pass: config.password,
      },

      pool: true,

      maxConnections: 3,

      maxMessages: 100,
    });
  }

  return transporter;
}

function normalizeLocale(locale) {
  return locale === "it" ? "it" : "en";
}

function buildOtpTemplate({ purpose, code, expiresIn, locale }) {
  const language = normalizeLocale(locale);

  const minutes = Math.max(1, Math.ceil(Number(expiresIn) / 60));

  /*
  |--------------------------------------------------------------------------
  | PASSWORD RESET
  |--------------------------------------------------------------------------
  */

  if (purpose === "password_reset") {
    if (language === "it") {
      return {
        subject: "Reimposta la password Redress",

        text:
          `Il tuo codice per reimpostare la password Redress è ${code}. ` +
          `Il codice scadrà tra ${minutes} minuti. ` +
          `Se non hai richiesto la modifica della password, ignora questa email.`,

        html: `
          <!doctype html>
          <html lang="it">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <title>Redress</title>
            </head>

            <body style="margin:0;padding:0;background:#f6f6f6;font-family:Arial,Helvetica,sans-serif;color:#202020;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding:40px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#ffffff;border-radius:12px;">
                      <tr>
                        <td style="padding:36px;">
                          <div style="font-size:24px;font-weight:700;margin-bottom:24px;">
                            Redress
                          </div>

                          <div style="font-size:18px;font-weight:600;margin-bottom:12px;">
                            Reimposta la password
                          </div>

                          <div style="font-size:14px;line-height:22px;margin-bottom:24px;color:#555555;">
                            Utilizza il seguente codice per reimpostare la password del tuo account Redress.
                          </div>

                          <div style="font-size:34px;font-weight:700;letter-spacing:8px;text-align:center;padding:20px;background:#f5f5f5;border-radius:10px;margin-bottom:24px;">
                            ${code}
                          </div>

                          <div style="font-size:14px;line-height:22px;color:#555555;">
                            Il codice scadrà tra <strong>${minutes} minuti</strong>.
                          </div>

                          <div style="font-size:13px;line-height:20px;color:#888888;margin-top:24px;">
                            Se non hai richiesto la modifica della password, puoi ignorare questa email.
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
          </html>
        `,
      };
    }

    return {
      subject: "Reset your Redress password",

      text:
        `Your Redress password reset code is ${code}. ` +
        `This code expires in ${minutes} minutes. ` +
        `If you did not request a password reset, ignore this email.`,

      html: `
        <!doctype html>
        <html lang="en">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Redress</title>
          </head>

          <body style="margin:0;padding:0;background:#f6f6f6;font-family:Arial,Helvetica,sans-serif;color:#202020;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="padding:40px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#ffffff;border-radius:12px;">
                    <tr>
                      <td style="padding:36px;">
                        <div style="font-size:24px;font-weight:700;margin-bottom:24px;">
                          Redress
                        </div>

                        <div style="font-size:18px;font-weight:600;margin-bottom:12px;">
                          Reset your password
                        </div>

                        <div style="font-size:14px;line-height:22px;margin-bottom:24px;color:#555555;">
                          Use the verification code below to reset your Redress account password.
                        </div>

                        <div style="font-size:34px;font-weight:700;letter-spacing:8px;text-align:center;padding:20px;background:#f5f5f5;border-radius:10px;margin-bottom:24px;">
                          ${code}
                        </div>

                        <div style="font-size:14px;line-height:22px;color:#555555;">
                          This code expires in <strong>${minutes} minutes</strong>.
                        </div>

                        <div style="font-size:13px;line-height:20px;color:#888888;margin-top:24px;">
                          If you did not request a password reset, you can safely ignore this email.
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | EMAIL SIGNUP / VERIFICATION
  |--------------------------------------------------------------------------
  */

  if (language === "it") {
    return {
      subject: "Verifica il tuo indirizzo email Redress",

      text:
        `Il tuo codice di verifica Redress è ${code}. ` +
        `Il codice scadrà tra ${minutes} minuti. ` +
        `Non condividere questo codice con nessuno.`,

      html: `
        <!doctype html>
        <html lang="it">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Redress</title>
          </head>

          <body style="margin:0;padding:0;background:#f6f6f6;font-family:Arial,Helvetica,sans-serif;color:#202020;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="padding:40px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#ffffff;border-radius:12px;">
                    <tr>
                      <td style="padding:36px;">
                        <div style="font-size:24px;font-weight:700;margin-bottom:24px;">
                          Redress
                        </div>

                        <div style="font-size:18px;font-weight:600;margin-bottom:12px;">
                          Verifica il tuo indirizzo email
                        </div>

                        <div style="font-size:14px;line-height:22px;margin-bottom:24px;color:#555555;">
                          Inserisci questo codice nell'app Redress per verificare il tuo indirizzo email.
                        </div>

                        <div style="font-size:34px;font-weight:700;letter-spacing:8px;text-align:center;padding:20px;background:#f5f5f5;border-radius:10px;margin-bottom:24px;">
                          ${code}
                        </div>

                        <div style="font-size:14px;line-height:22px;color:#555555;">
                          Il codice scadrà tra <strong>${minutes} minuti</strong>.
                        </div>

                        <div style="font-size:13px;line-height:20px;color:#888888;margin-top:24px;">
                          Non condividere questo codice con nessuno. Redress non ti chiederà mai il codice di verifica.
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
    };
  }

  return {
    subject: "Verify your Redress email",

    text:
      `Your Redress verification code is ${code}. ` +
      `This code expires in ${minutes} minutes. ` +
      `Do not share this code with anyone.`,

    html: `
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Redress</title>
        </head>

        <body style="margin:0;padding:0;background:#f6f6f6;font-family:Arial,Helvetica,sans-serif;color:#202020;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td align="center" style="padding:40px 20px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#ffffff;border-radius:12px;">
                  <tr>
                    <td style="padding:36px;">
                      <div style="font-size:24px;font-weight:700;margin-bottom:24px;">
                        Redress
                      </div>

                      <div style="font-size:18px;font-weight:600;margin-bottom:12px;">
                        Verify your email
                      </div>

                      <div style="font-size:14px;line-height:22px;margin-bottom:24px;color:#555555;">
                        Enter this verification code in the Redress app to verify your email address.
                      </div>

                      <div style="font-size:34px;font-weight:700;letter-spacing:8px;text-align:center;padding:20px;background:#f5f5f5;border-radius:10px;margin-bottom:24px;">
                        ${code}
                      </div>

                      <div style="font-size:14px;line-height:22px;color:#555555;">
                        This code expires in <strong>${minutes} minutes</strong>.
                      </div>

                      <div style="font-size:13px;line-height:20px;color:#888888;margin-top:24px;">
                        Do not share this code with anyone. Redress will never ask you for your verification code.
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  };
}

export async function sendOtpEmail({
  to,
  purpose = "auth",
  code,
  locale,
  expiresIn,
}) {
  const config = getMailConfig();

  const template = buildOtpTemplate({
    purpose,
    code,
    expiresIn,
    locale,
  });

  const mailer = getTransporter();

  const info = await mailer.sendMail({
    from: config.from,

    to,

    subject: template.subject,

    text: template.text,

    html: template.html,
  });

  const acceptedRecipients = Array.isArray(info.accepted) ? info.accepted : [];
  const rejectedRecipients = Array.isArray(info.rejected) ? info.rejected : [];

  /*
   * Nodemailer resolves when the SMTP exchange completes, including cases
   * where a server rejects the recipient. Do not let the OTP API claim a
   * delivery was accepted unless this single-recipient message was accepted.
   */
  if (acceptedRecipients.length !== 1 || rejectedRecipients.length > 0) {
    throw new Error("SMTP did not accept the OTP email recipient.");
  }

  return {
    messageId: info.messageId ?? null,
    acceptedRecipientCount: acceptedRecipients.length,
  };
}

export async function verifyMailTransport() {
  const mailer = getTransporter();

  await mailer.verify();

  return true;
}
