import { describe, expect, it } from "vitest";
import { generateOtp, hashOtp, normalizeIndianPhone, verifyOtpHash } from "@/lib/auth/otp";

const KEY = "test-secret-test-secret-test-secret-123";

describe("phone + OTP", () => {
  it("normalises Indian mobile numbers", () => {
    expect(normalizeIndianPhone("+91 98765-43210")).toBe("9876543210");
    expect(normalizeIndianPhone("09876543210")).toBe("9876543210");
    expect(normalizeIndianPhone("919876543210")).toBe("9876543210");
    expect(normalizeIndianPhone("12345")).toBeNull();
    expect(normalizeIndianPhone("5876543210")).toBeNull(); // Indian mobiles start 6–9
  });

  it("generates 4-digit codes", () => {
    for (let i = 0; i < 200; i++) expect(generateOtp()).toMatch(/^[1-9]\d{3}$/);
  });

  it("verifies only the right code for the right phone", () => {
    const h = hashOtp("9876543210", "4821", KEY);
    expect(verifyOtpHash("9876543210", "4821", h, KEY)).toBe(true);
    expect(verifyOtpHash("9876543210", "4822", h, KEY)).toBe(false);
    expect(verifyOtpHash("9876543211", "4821", h, KEY)).toBe(false);
    expect(verifyOtpHash("9876543210", "4821", h, "another-key-another-key-another-key")).toBe(false);
  });
});
