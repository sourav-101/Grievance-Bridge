/** Complaint photo rules (pure — shared by server and tests). */

/** Browser compresses to ~0.3 MB; this cap stays well under Vercel's 4.5 MB request limit. */
export const MAX_PHOTO_UPLOAD_BYTES = 3 * 1024 * 1024;

export type PhotoType = "image/jpeg" | "image/png" | "image/webp";

/** Identify an image from its first bytes (never trust the file name or declared type). */
export function sniffImageType(bytes: Uint8Array): PhotoType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)) return "image/png";
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export const photoExtension = (type: PhotoType) => (type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg");
