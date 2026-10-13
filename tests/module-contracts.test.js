import { describe, expect, it } from "vitest";

import * as mediaUrlService from "../src/services/media-url.service.js";
import * as s3Service from "../src/services/s3.service.js";
import * as passwordRepository from "../src/modules/auth/password.repository.js";

describe("module export contracts", () => {
  it("provides every S3 capability required by the real auth service", () => {
    expect(s3Service.buildProfilePhotoKey).toEqual(expect.any(Function));
    expect(s3Service.deleteFromS3).toEqual(expect.any(Function));
    expect(s3Service.uploadToS3).toEqual(expect.any(Function));
    expect(s3Service.deleteObject).toEqual(expect.any(Function));
    expect(s3Service.getObject).toEqual(expect.any(Function));
    expect(s3Service.uploadObject).toEqual(expect.any(Function));
  });

  it("generates application-hosted opaque URLs for media delivery", () => {
    expect(mediaUrlService.createMediaUrl).toEqual(expect.any(Function));
    expect(mediaUrlService.resolveMediaUrlToken).toEqual(expect.any(Function));
  });

  it("provides every password-reset repository capability used by the service", () => {
    expect(
      passwordRepository.supersedePendingPasswordResetChallenges,
    ).toEqual(expect.any(Function));
  });
});
