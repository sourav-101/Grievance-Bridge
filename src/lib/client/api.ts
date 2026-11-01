"use client";
import { englishServerMessage } from "@/lib/i18n/server-messages";

export class ApiError extends Error {
  constructor(message: string, public status: number, public data: Record<string, unknown> = {}) {
    super(message);
  }
}

/** Language picked on this device (see LanguageProvider); read directly so plain functions can use it. */
function storedLanguage(): string | null {
  try {
    return localStorage.getItem("iitr.dialect");
  } catch {
    return null;
  }
}

/** Every API request says which language the person is using (server messages follow it where translated). */
function langHeaders(): Record<string, string> {
  return storedLanguage() === "english" ? { "x-lang": "en" } : {};
}

async function handle<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined" && !location.pathname.startsWith("/login") && !location.pathname.startsWith("/admin")) {
      location.href = `/login?next=${encodeURIComponent(location.pathname)}`;
    }
    const english = storedLanguage() === "english";
    const fallback = english ? "Something went wrong. Please try again." : "कुछ गड़बड़ हो गई। फिर से कोशिश करें।";
    let message = typeof data.error === "string" ? data.error : fallback;
    // Worker routes answer in Hindi; show the English version when the site is in English.
    if (english) message = englishServerMessage(message) ?? message;
    throw new ApiError(message, res.status, data);
  }
  return data as T;
}

export async function getJson<T>(url: string): Promise<T> {
  return handle<T>(await fetch(url, { cache: "no-store", headers: langHeaders() }));
}

export async function sendJson<T>(url: string, body: unknown, method: "POST" | "PATCH" | "DELETE" = "POST"): Promise<T> {
  return handle<T>(
    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", ...langHeaders() },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
}

export async function postForm<T>(url: string, form: FormData): Promise<T> {
  return handle<T>(await fetch(url, { method: "POST", body: form, headers: langHeaders() }));
}

/** POST a JSON body, as multipart { payload, photo } when a photo is attached. */
export async function sendJsonWithPhoto<T>(url: string, body: unknown, photo: Blob | null): Promise<T> {
  if (!photo) return sendJson<T>(url, body);
  const form = new FormData();
  form.append("payload", JSON.stringify(body));
  form.append("photo", photo, "photo.jpg");
  return postForm<T>(url, form);
}

export function audioForm(blob: Blob, extra: Record<string, string> = {}): FormData {
  const form = new FormData();
  const ext = blob.type.includes("wav") ? "wav" : blob.type.includes("mp4") ? "m4a" : "webm";
  form.append("audio", blob, `recording.${ext}`);
  for (const [k, v] of Object.entries(extra)) form.append(k, v);
  return form;
}

/** sessionStorage that never throws (private mode, blocked storage, …). */
export const safeSession = {
  get<T>(key: string, fallback: T): T {
    try {
      const v = sessionStorage.getItem(key);
      return v ? (JSON.parse(v) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  },
};
