/**
 * Environment helpers. Values that still look like the `YOUR_…` placeholders
 * from .env.example are treated as "not configured" so features can degrade
 * gracefully (e.g. browser speech synthesis when Sarvam TTS is not set up).
 */

/** Placeholders can sit inside a value too, e.g. "https://YOUR_PROJECT_REF.supabase.co". */
const isPlaceholder = (v: string) => v.includes("YOUR_");

export function isConfigured(name: string): boolean {
  const v = process.env[name];
  return !!v && v.trim() !== "" && !isPlaceholder(v);
}

export function env(name: string, fallback?: string): string {
  const v = process.env[name];
  if (v === undefined || v.trim() === "" || isPlaceholder(v)) {
    if (fallback !== undefined) return fallback;
    throw new ConfigError(name);
  }
  return v;
}

export function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export class ConfigError extends Error {
  constructor(public variable: string) {
    super(`Missing environment variable ${variable}. Copy .env.example to .env.local and fill it in.`);
    this.name = "ConfigError";
  }
}

export const isOtpDevMode = () => process.env.OTP_DEV_MODE === "true";
