import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createMediaUrl,
  resolveMediaUrlToken,
} from "../src/services/media-url.service.js";

describe("opaque media URLs", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates a same-origin API URL without exposing the bucket or object key", () => {
    const url = createMediaUrl("profiles/7/photo.webp");
    const parsed = new URL(url);

    expect(parsed.origin).toBe("http://localhost:5001");
    expect(parsed.pathname).toMatch(/^\/api\/v1\/media\/[A-Za-z0-9_-]+$/);
    expect(url).not.toContain("profiles");
    expect(url).not.toContain("photo.webp");
    expect(url).not.toContain("redress-test-bucket");
    expect(resolveMediaUrlToken(parsed.pathname.split("/").at(-1))).toBe(
      "profiles/7/photo.webp",
    );
  });

  it("creates media URLs for uploaded Home placement assets", () => {
    const token = new URL(
      createMediaUrl("home/banners/test-women.webp"),
    ).pathname.split("/").at(-1);

    expect(resolveMediaUrlToken(token)).toBe("home/banners/test-women.webp");
  });

  it("creates media URLs for review photos", () => {
    const token = new URL(
      createMediaUrl("reviews/77/photo-1.webp"),
    ).pathname.split("/").at(-1);

    expect(resolveMediaUrlToken(token)).toBe("reviews/77/photo-1.webp");
  });

  it("returns null for missing, modified, and malformed tokens", () => {
    expect(createMediaUrl(null)).toBeNull();
    expect(resolveMediaUrlToken("not-a-token")).toBeNull();

    const token = new URL(createMediaUrl("products/item/main.webp"))
      .pathname.split("/")
      .at(-1);
    const replacementCharacter = token.endsWith("A") ? "B" : "A";
    const modifiedToken = `${token.slice(0, -1)}${replacementCharacter}`;

    expect(resolveMediaUrlToken(modifiedToken)).toBeNull();
  });

  it("expires opaque URLs after their short-lived bearer window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-07T07:00:00.000Z"));

    const token = new URL(createMediaUrl("profiles/7/photo.webp"))
      .pathname.split("/")
      .at(-1);

    vi.advanceTimersByTime(15 * 60 * 1000);

    expect(resolveMediaUrlToken(token)).toBeNull();
  });

  it("refuses to mint media URLs for keys outside the application media prefixes", () => {
    expect(() => createMediaUrl("private/secrets.txt")).toThrow(
      "Media storage key is invalid.",
    );
    expect(() => createMediaUrl("../profiles/7/photo.webp")).toThrow(
      "Media storage key is invalid.",
    );
  });
});
