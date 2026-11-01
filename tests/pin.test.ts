import { describe, expect, it } from "vitest";
import { authMode, generateResetCode, hashSecret, isWeakPin, verifySecret } from "@/lib/auth/pin";

const KEY = "test-pepper-test-pepper-test-pepper-1234";

describe("PIN rules", () => {
  it("rejects easy PINs", () => {
    for (const p of ["0000", "1111", "1234", "4321", "6789", "9876", "0123", "12a4", "123"]) expect(isWeakPin(p)).toBe(true);
  });
  it("accepts ordinary PINs", () => {
    for (const p of ["4826", "1357", "9020", "1123"]) expect(isWeakPin(p)).toBe(false);
  });
  it("defaults to PIN mode unless AUTH_MODE=otp", () => {
    const old = process.env.AUTH_MODE;
    delete process.env.AUTH_MODE;
    expect(authMode()).toBe("pin");
    process.env.AUTH_MODE = "otp";
    expect(authMode()).toBe("otp");
    if (old === undefined) delete process.env.AUTH_MODE;
    else process.env.AUTH_MODE = old;
  });
});

describe("PIN hashing", () => {
  it("verifies only the right PIN for the right phone with the right pepper", async () => {
    const h = await hashSecret("9876543210", "4826", KEY);
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await verifySecret("9876543210", "4826", h, KEY)).toBe(true);
    expect(await verifySecret("9876543210", "4827", h, KEY)).toBe(false);
    expect(await verifySecret("9876543211", "4826", h, KEY)).toBe(false);
    expect(await verifySecret("9876543210", "4826", h, "other-pepper-other-pepper-other-pepper")).toBe(false);
    expect(await verifySecret("9876543210", "4826", null, KEY)).toBe(false);
    expect(await verifySecret("9876543210", "4826", "garbage", KEY)).toBe(false);
  });
  it("salts each hash", async () => {
    expect(await hashSecret("9876543210", "4826", KEY)).not.toBe(await hashSecret("9876543210", "4826", KEY));
  });
  it("reset codes are 6 digits", () => {
    for (let i = 0; i < 100; i++) expect(generateResetCode()).toMatch(/^[1-9]\d{5}$/);
  });
});
