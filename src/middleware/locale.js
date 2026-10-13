import { env } from "../config/env.js";

function normalizeLanguage(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const language = value
    .trim()
    .toLowerCase()
    .split(",")[0]
    .split(";")[0]
    .split("-")[0];

  if (env.APP_SUPPORTED_LANGUAGES.includes(language)) {
    return language;
  }

  return null;
}

export function localeMiddleware(request, response, next) {
  /*
   * Query parameter has highest priority:
   *
   * ?lang=en
   */
  const queryLanguage = normalizeLanguage(request.query?.lang);

  /*
   * Then Accept-Language.
   */
  const headerLanguage = normalizeLanguage(request.get("accept-language"));

  /*
   * Italian fallback.
   */
  const locale = queryLanguage ?? headerLanguage ?? env.APP_DEFAULT_LANGUAGE;

  request.locale = locale;

  response.set("Content-Language", locale);

  return next();
}
