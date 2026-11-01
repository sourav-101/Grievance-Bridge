import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ConfigError } from "./env";
import { MAX_AUDIO_UPLOAD_BYTES } from "./constants";
import { MAX_PHOTO_UPLOAD_BYTES, sniffImageType, type PhotoType } from "./grievances/photo";

/** Hindi or English message, following the client's `x-lang: en` header. */
export function msgFor(req: Request) {
  const english = req.headers.get("x-lang") === "en";
  return (hi: string, en: string) => (english ? en : hi);
}

export function jsonError(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

/** Uniform error handling for route handlers. */
export function handleRouteError(err: unknown, context: string) {
  if (err instanceof ZodError) {
    return jsonError("Invalid request", 400, { issues: err.issues.map((i) => `${i.path.join(".")}: ${i.message}`) });
  }
  if (err instanceof ConfigError) {
    console.error(`[${context}]`, err.message);
    return jsonError(`Server is not configured: ${err.variable} is missing.`, 503);
  }
  if (isConnectionError(err)) {
    console.error(
      `[${context}] Cannot reach Supabase (${describeCause(err)}). Check NEXT_PUBLIC_SUPABASE_URL and your network; run \`npm run check:setup\`.`,
    );
    return jsonError("सर्वर डेटाबेस से नहीं जुड़ पा रहा है। कृपया थोड़ी देर बाद कोशिश करें।", 503, { code: "DB_UNREACHABLE" });
  }
  if (err instanceof UpstreamError) {
    console.error(`[${context}] upstream ${err.service} failed:`, err.message);
    return jsonError(`${err.service} सेवा अभी उपलब्ध नहीं है। कृपया थोड़ी देर बाद फिर कोशिश करें।`, 502);
  }
  console.error(`[${context}]`, err);
  return jsonError("कुछ गड़बड़ हो गई। कृपया फिर से कोशिश करें।", 500);
}

/** Thrown when a third-party API (Sarvam, Groq, Tavily, Gemini, Fast2SMS) fails. */
export class UpstreamError extends Error {
  constructor(public service: string, message: string, public status?: number) {
    super(message);
    this.name = "UpstreamError";
  }
}

/** Read and validate an audio Blob from multipart form data. */
export async function readAudio(form: FormData, field = "audio"): Promise<Blob | null> {
  const value = form.get(field);
  if (!value || typeof value === "string") return null;
  const blob = value as Blob;
  if (blob.size === 0) return null;
  if (blob.size > MAX_AUDIO_UPLOAD_BYTES) throw new AudioTooLargeError();
  return blob;
}

/** Read and validate an optional complaint photo (JPEG / PNG / WebP, checked by its bytes). */
export async function readPhoto(form: FormData, field = "photo"): Promise<{ bytes: Uint8Array; type: PhotoType } | null> {
  const value = form.get(field);
  if (!value || typeof value === "string") return null;
  const blob = value as Blob;
  if (blob.size === 0) return null;
  if (blob.size > MAX_PHOTO_UPLOAD_BYTES) throw new PhotoError("too_large");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const type = sniffImageType(bytes);
  if (!type) throw new PhotoError("not_image");
  return { bytes, type };
}

export class PhotoError extends Error {
  constructor(public reason: "too_large" | "not_image") {
    super(reason === "too_large" ? "Photo too large" : "Not a JPEG/PNG/WebP image");
  }
}

export class AudioTooLargeError extends Error {
  constructor() {
    super("Audio too large");
  }
}

export async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 20000): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

/** supabase-js surfaces network failures as { message: "TypeError: fetch failed" }. */
export function isConnectionError(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message ?? err);
  return /fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|UND_ERR_CONNECT/i.test(msg);
}

function describeCause(err: unknown): string {
  const e = err as { message?: string; cause?: { code?: string; message?: string } };
  return [e.message, e.cause?.code, e.cause?.message].filter(Boolean).join(" / ");
}

/** Throw on a Supabase error so failures are never silently treated as "no row". */
export function assertNoDbError(error: { message: string } | null | undefined, what: string): void {
  if (error) throw new Error(`${what}: ${error.message}`);
}
