import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

export const OTP_TTL_SECONDS = 5 * 60;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_MAX_SENDS_PER_WINDOW = 3;
export const OTP_SEND_WINDOW_SECONDS = 15 * 60;

/** Accepts "+91 98765-43210", "098765 43210", "9876543210" → "9876543210". */
export function normalizeIndianPhone(input: string): string | null {
  let digits = (input || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

export function generateOtp(): string {
  return String(randomInt(1000, 10000));
}

function secret(): string {
  const s = process.env.WORKER_SESSION_SECRET;
  if (!s || s.startsWith("YOUR_")) throw new Error("WORKER_SESSION_SECRET is not set");
  return s;
}

export function hashOtp(phone: string, code: string, key = secret()): string {
  return createHmac("sha256", key).update(`otp:${phone}:${code}`).digest("hex");
}

export function verifyOtpHash(phone: string, code: string, expectedHash: string, key = secret()): boolean {
  const actual = Buffer.from(hashOtp(phone, code, key), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
