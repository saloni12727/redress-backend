const PRODUCTION_ORIGINS = new Set([
  "https://redress.cyberimpulses.com",
  "https://www.redress.cyberimpulses.com",
  "https://redressbackend.cyberimpulses.com",
]);

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function parseOrigin(value) {
  if (typeof value !== "string" || value === "null") {
    return null;
  }

  try {
    const parsed = new URL(value);
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function isAllowedCorsOrigin(origin, configuration) {
  const parsedOrigin = parseOrigin(origin);
  if (!parsedOrigin) {
    return false;
  }

  const normalizedOrigin = parsedOrigin.origin;
  if (
    configuration.CORS_ORIGINS.includes(normalizedOrigin) ||
    PRODUCTION_ORIGINS.has(normalizedOrigin)
  ) {
    return true;
  }

  return (
    configuration.NODE_ENV !== "production" &&
    LOOPBACK_HOSTS.has(parsedOrigin.hostname.toLowerCase())
  );
}
