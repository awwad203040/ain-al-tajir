import { describe, expect, it } from "vitest";

import { validateFreeRegistration } from "../lib/free-registration";

describe("free registration", () => {
  it("accepts a complete customer registration before secure sign-in", () => {
    expect(validateFreeRegistration({ ownerName: "أحمد محمد", ownerEmail: "ahmed@example.sa", contactPhone: "0500000000" })).toBeUndefined();
  });

  it("rejects incomplete customer identity fields", () => {
    expect(validateFreeRegistration({ ownerName: "أ", ownerEmail: "owner@example.sa", contactPhone: "0500000000" })).toBe("owner_name");
    expect(validateFreeRegistration({ ownerName: "أحمد", ownerEmail: "invalid-email", contactPhone: "0500000000" })).toBe("owner_email");
    expect(validateFreeRegistration({ ownerName: "أحمد", ownerEmail: "owner@example.sa", contactPhone: "123" })).toBe("contact_phone");
  });
});
