import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env";
import { photoExtension, type PhotoType } from "../grievances/photo";

let client: SupabaseClient | null = null;

/**
 * Service-role client. Bypasses RLS — use ONLY in server code after the caller
 * has been authenticated/authorised.
 */
export function supabaseAdmin(): SupabaseClient {
  if (!client) {
    client = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export const audioBucket = () => process.env.SUPABASE_AUDIO_BUCKET || "worker-audio-vault";

/** Upload audio to the private vault and return its storage path. */
export async function uploadAudio(folder: "drafts" | "grievances" | "feedback", blob: Blob): Promise<string> {
  // The bucket's allowed_mime_types list has bare types, so drop codec parameters
  // ("audio/webm;codecs=opus" → "audio/webm") or the upload is rejected.
  const contentType = (blob.type || "audio/wav").split(";")[0].trim();
  const ext = contentType.includes("wav")
    ? "wav"
    : contentType.includes("webm")
      ? "webm"
      : contentType.includes("mp4")
        ? "m4a"
        : contentType.includes("ogg")
          ? "ogg"
          : "bin";
  const path = `${folder}/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabaseAdmin()
    .storage.from(audioBucket())
    .upload(path, blob, { contentType, upsert: false });
  if (error) throw new Error(`Audio upload failed: ${error.message}`);
  return path;
}

/** Short-lived signed URL for private audio playback (admin console). */
export async function signedAudioUrl(path: string | null, expiresInSeconds = 600): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabaseAdmin().storage.from(audioBucket()).createSignedUrl(path, expiresInSeconds);
  if (error) {
    console.error("signedAudioUrl", error.message);
    return null;
  }
  return data.signedUrl;
}

export const photoBucket = () => process.env.SUPABASE_PHOTO_BUCKET || "worker-photo-vault";

/** Upload a validated complaint photo to the private photo vault; returns its storage path. */
export async function uploadPhoto(photo: { bytes: Uint8Array; type: PhotoType }): Promise<string> {
  const path = `grievances/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${photoExtension(photo.type)}`;
  const { error } = await supabaseAdmin()
    .storage.from(photoBucket())
    .upload(path, photo.bytes, { contentType: photo.type, upsert: false });
  if (error) {
    if (/bucket not found/i.test(error.message)) {
      throw new Error("Photo upload failed: bucket missing. Run supabase/migrations/0004_photos.sql in the SQL Editor.");
    }
    throw new Error(`Photo upload failed: ${error.message}`);
  }
  return path;
}

/** Short-lived signed URL for a private complaint photo (admin console). */
export async function signedPhotoUrl(path: string | null | undefined, expiresInSeconds = 600): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabaseAdmin().storage.from(photoBucket()).createSignedUrl(path, expiresInSeconds);
  if (error) {
    console.error("signedPhotoUrl", error.message);
    return null;
  }
  return data.signedUrl;
}

/** Delete photos (best effort, e.g. when the complaint could not be saved). */
export async function removePhotos(paths: string[]): Promise<void> {
  if (!paths.length) return;
  const { error } = await supabaseAdmin().storage.from(photoBucket()).remove(paths);
  if (error) console.warn("removePhotos failed", error.message);
}

/** A draft recording was already used (or expired and was cleaned up). */
export class DraftAlreadyUsedError extends Error {
  constructor() {
    super("Draft recording already used");
  }
}

/**
 * Move a draft recording into its permanent folder; returns the new path.
 * The draft file doubles as a single-use marker: once it has been moved, the
 * same draft token cannot file a second ticket.
 */
export async function promoteDraftAudio(draftPath: string): Promise<string> {
  const finalPath = draftPath.replace(/^drafts\//, "grievances/");
  if (finalPath === draftPath) return draftPath;
  const { error } = await supabaseAdmin().storage.from(audioBucket()).move(draftPath, finalPath);
  if (error) {
    if (/not.?found|does not exist/i.test(error.message)) throw new DraftAlreadyUsedError();
    throw new Error(`Audio move failed: ${error.message}`);
  }
  return finalPath;
}

/** Delete a draft recording (anonymous filing). Throws DraftAlreadyUsedError if it is already gone. */
export async function consumeDraftAudio(draftPath: string): Promise<void> {
  const { data, error } = await supabaseAdmin().storage.from(audioBucket()).remove([draftPath]);
  if (error) throw new Error(`Audio delete failed: ${error.message}`);
  if (!data?.length) throw new DraftAlreadyUsedError();
}
