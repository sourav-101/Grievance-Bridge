"use client";
import { Camera, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/shared/LanguageProvider";
import { compressPhoto } from "@/lib/client/image";

/**
 * Optional photo of the problem (broken tap, missing safety gear …). The phone
 * offers camera or gallery; the picture is shrunk before upload and shown as a
 * preview with a remove button.
 */
export function PhotoPicker({ value, onChange }: { value: Blob | null; onChange: (photo: Blob | null) => void }) {
  const { t } = useLanguage();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!value) return setPreview(null);
    const url = URL.createObjectURL(value);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError(t("यह फोटो नहीं है। कोई फोटो चुनें।", "This is not a photo. Choose a photo."));
      return;
    }
    setBusy(true);
    try {
      onChange(await compressPhoto(file));
    } catch {
      setError(t("यह फोटो नहीं खुल रही। कोई दूसरी फोटो चुनें।", "This photo cannot be opened. Choose another photo."));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = ""; // allow picking the same file again
    }
  }

  return (
    <div className="space-y-2">
      <span className="block text-lg font-bold">
        {t("फोटो", "Photo")} <span className="text-base font-normal text-ink-soft">({t("ज़रूरी नहीं", "optional")})</span>
      </span>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
      {preview ? (
        <div className="relative w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt={t("चुनी गई फोटो", "Selected photo")} className="max-h-48 rounded-2xl border border-line object-cover" />
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={t("फोटो हटाएं", "Remove photo")}
            className="absolute -right-2 -top-2 grid size-9 place-items-center rounded-full bg-ink text-white shadow"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-ink-soft bg-white text-xl font-semibold text-ink disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-6 animate-spin" aria-hidden /> : <Camera className="size-7 text-brand" aria-hidden />}
          {t("समस्या की फोटो जोड़ें", "Add a photo of the problem")}
        </button>
      )}
      <p className="text-sm text-ink-soft">
        {t("सिर्फ़ समस्या की फोटो लें (टूटा नल, कचरा, खराब उपकरण)। किसी का चेहरा न दिखे।", "Photograph only the problem (broken tap, garbage, faulty equipment). Avoid people's faces.")}
      </p>
      {error && <p role="alert" className="text-base font-semibold text-danger">{error}</p>}
    </div>
  );
}
