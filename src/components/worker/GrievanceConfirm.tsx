"use client";
import { TriangleAlert, CircleCheck, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLanguage } from "@/components/shared/LanguageProvider";
import { useSpeech } from "@/components/shared/SpeechProvider";
import { ApiError, sendJsonWithPhoto } from "@/lib/client/api";
import type { GrievanceCategory, SpeechPayload, WorkerTicketView } from "@/lib/types";
import { AnonymousToggle, CategoryPicker, ZoneSelect } from "./GrievanceFields";
import { PhotoPicker } from "./PhotoPicker";
import type { GrievanceDraft } from "./WorkerProvider";

/** Confirm a voice grievance draft: fix category/location, choose anonymity, submit. */
export function GrievanceConfirm({
  draft,
  transcript,
  defaultAnonymous = false,
  onDone,
}: {
  draft: GrievanceDraft;
  transcript: string;
  defaultAnonymous?: boolean;
  onDone?: () => void;
}) {
  const router = useRouter();
  const { play } = useSpeech();
  const { dialect, t } = useLanguage();
  const [category, setCategory] = useState<GrievanceCategory>(draft.category);
  const [zoneId, setZoneId] = useState<string | null>(draft.zoneId);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [anonymous, setAnonymous] = useState(defaultAnonymous);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!zoneId) {
      setError(t("कृपया जगह चुनें।", "Please choose a place."));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await sendJsonWithPhoto<{ ticket: WorkerTicketView; speech: SpeechPayload }>("/api/grievances", {
        mode: "draft",
        draftToken: draft.token,
        isAnonymous: anonymous,
        category,
        zoneId,
        dialect,
      }, photo);
      void play(res.speech, "receipt");
      onDone?.();
      router.push(`/ticket/${res.ticket.token}?new=1`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("शिकायत दर्ज नहीं हो सकी। फिर से कोशिश करें।", "Could not register the complaint. Please try again."));
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {draft.isEmergency && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger p-3 text-white">
          <TriangleAlert className="mt-0.5 size-7 shrink-0" aria-hidden />
          <p className="text-lg font-bold">{t("आपातकालीन शिकायत। किसी को चोट लगी है तो तुरंत ऊपर लाल बटन से फ़ोन करें।", "Emergency complaint. If someone is hurt, call now using the red button at the top.")}</p>
        </div>
      )}
      <blockquote className="rounded-2xl bg-paper p-3 text-lg">
        <span className="block text-sm font-bold text-ink-soft">{t("आपने कहा:", "You said:")}</span>“{transcript}”
      </blockquote>
      <div>
        <p className="mb-1.5 text-lg font-bold">{t("समस्या का प्रकार", "Type of problem")}</p>
        <CategoryPicker value={category} onChange={setCategory} />
      </div>
      <ZoneSelect value={zoneId} onChange={setZoneId} />
      <PhotoPicker value={photo} onChange={setPhoto} />
      <AnonymousToggle value={anonymous} onChange={setAnonymous} />
      {error && (
        <p role="alert" className="rounded-xl bg-danger/10 p-3 text-lg font-bold text-danger">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        className="flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-ok text-2xl font-bold text-white shadow-md transition active:scale-[0.98] disabled:opacity-70"
      >
        {submitting ? <Loader2 className="size-7 animate-spin" aria-hidden /> : <CircleCheck className="size-8" aria-hidden />}
        {t("शिकायत दर्ज करें", "Register complaint")}
      </button>
    </div>
  );
}
