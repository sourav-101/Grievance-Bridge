import { createHmac, randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (pw: string | Buffer, salt: Buffer, keylen: number) => Promise<Buffer>;

export const PIN_MAX_ATTEMPTS = 5;
export const PIN_LOCK_MINUTES = 15;
export const RESET_CODE_TTL_HOURS = 48;

export type AuthMode = "pin" | "otp";

/** AUTH_MODE env: "pin" (default, no SMS) or "otp" (Fast2SMS). */
export function authMode(): AuthMode {
  return process.env.AUTH_MODE === "otp" ? "otp" : "pin";
}

export { isWeakPin } from "./pin-rules";

function pepper(): string {
  const s = process.env.WORKER_SESSION_SECRET;
  if (!s || s.startsWith("YOUR_")) throw new Error("WORKER_SESSION_SECRET is not set");
  return s;
}

/**
 * Hash: scrypt( HMAC(pepper, phone:pin) , random salt ). The server-side pepper
 * means a leaked database alone is not enough to brute-force the 10,000 PINs.
 */
export async function hashSecret(phone: string, secret: string, key = pepper()): Promise<string> {
  const salt = randomBytes(16);
  const peppered = createHmac("sha256", key).update(`pin:${phone}:${secret}`).digest();
  const hash = await scrypt(peppered, salt, 32);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifySecret(phone: string, secret: string, stored: string | null, key = pepper()): Promise<boolean> {
  if (!stored) return false;
  const [scheme, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const peppered = createHmac("sha256", key).update(`pin:${phone}:${secret}`).digest();
  const actual = await scrypt(peppered, Buffer.from(saltB64, "base64url"), 32);
  const expected = Buffer.from(hashB64, "base64url");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** One-time 6-digit code the Estate Office hands to the worker in person. */
export function generateResetCode(): string {
  return String(randomInt(100000, 1000000));
}
