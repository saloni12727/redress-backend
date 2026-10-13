import { describe, expect, it } from "vitest";

import {
  createBodyProfileSchema,
  estimateFieldsSchema,
  updateBodyProfileSchema,
} from "../src/modules/shopper-fit/shopper-fit.validation.js";

describe("shopper fit validation", () => {
  it("accepts the onboarding self-profile payload", () => {
    const result = createBodyProfileSchema.safeParse({
      name: "Ada Rossi",
      relation: "self",
      sex: "female",
      measurements: { heightCm: 170, weightKg: 62.5 },
    });

    expect(result.success).toBe(true);
  });

  it("rejects unsupported profile fields and sex values", () => {
    expect(
      createBodyProfileSchema.safeParse({
        name: "Ada Rossi",
        relation: "self",
        sex: "other",
        measurements: { heightCm: 170, weightKg: 62 },
      }).success,
    ).toBe(false);

    expect(
      createBodyProfileSchema.safeParse({
        name: "Ada Rossi",
        relation: "self",
        measurements: { heightCm: 170, weightKg: 62 },
        active: true,
      }).success,
    ).toBe(false);
  });

  it("accepts partial measurement and photo clear operations", () => {
    const result = updateBodyProfileSchema.safeParse({
      measurements: { waistCm: null },
      photos: { front: null },
    });

    expect(result.success).toBe(true);
  });

  it.each(["partner", "child", "other"])(
    "accepts changing a profile relation to %s",
    (relation) => {
      expect(updateBodyProfileSchema.safeParse({ relation }).success).toBe(true);
    },
  );

  it("rejects unsupported relation values", () => {
    expect(updateBodyProfileSchema.safeParse({ relation: "sibling" }).success).toBe(
      false,
    );
  });

  it("coerces valid estimator fields but rejects an invalid sex", () => {
    const valid = estimateFieldsSchema.safeParse({
      sex: "male",
      heightCm: "180",
      weightKg: "75.5",
    });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data).toMatchObject({ heightCm: 180, weightKg: 75.5 });
    }

    expect(
      estimateFieldsSchema.safeParse({
        sex: "unknown",
        heightCm: 180,
        weightKg: 75,
      }).success,
    ).toBe(false);
  });
});
