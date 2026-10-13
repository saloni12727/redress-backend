import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  repository: {
    findVendorById: vi.fn(),
    findVendors: vi.fn(),
    updateVendor: vi.fn(),
  },
}));

vi.mock("../src/modules/admin-vendors/admin-vendors.repository.js", () => state.repository);
vi.mock("../src/services/media/media-storage.service.js", () => ({
  getMediaUrl: vi.fn(() => "https://api.example/media/opaque"),
}));

import {
  approveVendor,
  updateAdminVendorStatus,
} from "../src/modules/admin-vendors/admin-vendors.service.js";

function vendor(overrides = {}) {
  return {
    id: 41,
    code: "atelier_north",
    slug: "atelier-north",
    displayName: "Atelier North",
    status: "inactive",
    approvalStatus: "pending",
    commissionType: "percentage",
    commissionValue: "0.00",
    defaultCurrencyCode: "EUR",
    vendorUsers: [],
    ...overrides,
  };
}

describe("Admin vendor approval service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.repository.findVendorById.mockResolvedValue(vendor());
    state.repository.updateVendor.mockImplementation(async (record, values) => ({
      ...record,
      ...values,
    }));
  });

  it("approves a pending application without activating it", async () => {
    const result = await approveVendor({ vendorId: 41 });

    expect(state.repository.updateVendor).toHaveBeenCalledWith(
      expect.objectContaining({ id: 41 }),
      expect.objectContaining({
        approvalStatus: "approved",
        rejectionReason: null,
      }),
    );
    expect(result.status).toBe("inactive");
    expect(result.approvalStatus).toBe("approved");
  });

  it("does not activate a vendor that has not been approved", async () => {
    await expect(
      updateAdminVendorStatus({ vendorId: 41, status: "active" }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "VENDOR_NOT_APPROVED",
    });
  });
});
