"use client";
import { CircleCheck, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLanguage } from "@/components/shared/LanguageProvider";
import { useSpeech } from "@/components/shared/SpeechProvider";
import { AnonymousToggle, CategoryPicker, ZoneSelect } from "@/components/worker/GrievanceFields";
import { GrievanceConfirm } from "@/components/worker/GrievanceConfirm";
import { GrievanceRecorderCard } from "@/components/worker/GrievanceRecorderCard";
import { MyRecentTickets } from "@/components/worker/MyRecentTickets";
import { PhotoPicker } from "@/components/worker/PhotoPicker";
import { useVoiceAgent } from "@/hooks/useVoiceAgent";
import { ApiError, sendJsonWithPhoto } from "@/lib/client/api";
import type { GrievanceCategory, SpeechPayload, WorkerTicketView } from "@/lib/types";

/**
 * Grievance page, phone-first order:
 *   1. recorder ("log current grievance") with anonymous switch
 *   2. my logged grievances, right below
 *   3. tap-a-picture fallback
 */
export default function GrievancePage() {
  const router = useRouter();
  const { play } = useSpeech();
  const { dialect, t } = useLanguage();
  const voice = useVoiceAgent("grievance", { inline: true });
  const [anonymous, setAnonymous] = useState(false);
  const [category, setCategory] = useState<GrievanceCategory | null>(null);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const draft = voice.result?.type === "grievance_draft" ? voice.result : null;

  async function submitTap() {
    if (!category || !zoneId) {
      setError(t("कृपया समस्या और जगह दोनों चुनें।", "Please choose both the problem and the place."));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await sendJsonWithPhoto<{ ticket: WorkerTicketView; speech: SpeechPayload }>("/api/grievances", {
        mode: "tap",
        category,
        zoneId,
        isAnonymous: anonymous,
        dialect,
      }, photo);
      void play(res.speech, "receipt");
      router.push(`/ticket/${res.ticket.token}?new=1`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("शिकायत दर्ज नहीं हो सकी।", "Could not register the complaint."));
      setSubmitting(false);
    }
  }

  if (draft) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        <h1 className="section-title">{t("शिकायत की पुष्टि करें", "Confirm your complaint")}</h1>
        <GrievanceConfirm draft={draft.draft} transcript={draft.transcript} defaultAnonymous={anonymous} />
        <button onClick={voice.clearResult} className="w-full py-3 text-base font-semibold text-brand underline">
          {t("रद्द करें, फिर से बोलें", "Cancel and speak again")}
        </button>
      </div>
    );
  }

  return (
    <div>
      <section className="hero-band px-4 pb-10 pt-7 text-white">
        <div className="mx-auto max-w-3xl space-y-5">
          <div className="text-center">
            <h1 className="section-title on-dark">{t("शिकायत दर्ज करें", "File a complaint")}</h1>
            <p className="mt-2 text-base text-white/90">{t("माइक दबाकर अपनी समस्या और जगह बोलें।", "Press the mic and say your problem and the place.")}</p>
          </div>
          <GrievanceRecorderCard voice={voice}>
            <AnonymousToggle value={anonymous} onChange={setAnonymous} />
          </GrievanceRecorderCard>
        </div>
      </section>

      <section className="px-4 py-8">
        <div className="mx-auto max-w-3xl space-y-5">
          <h2 className="section-title">{t("मेरी दर्ज शिकायतें", "My complaints")}</h2>
          <MyRecentTickets limit={5} />
        </div>
      </section>

      <section aria-labelledby="tap-h" className="bg-white px-4 py-8">
        <div className="mx-auto max-w-3xl space-y-5">
          <div className="text-center">
            <h2 id="tap-h" className="section-title">{t("बोल नहीं सकते? तस्वीर चुनें", "Can't speak? Choose a picture")}</h2>
            <p className="mt-2 text-base text-ink-soft">{t("समस्या की तस्वीर और जगह दबाएं", "Tap the problem and the place")}</p>
          </div>
          <CategoryPicker value={category} onChange={setCategory} />
          <ZoneSelect value={zoneId} onChange={setZoneId} />
          <PhotoPicker value={photo} onChange={setPhoto} />
          {error && (
            <p role="alert" className="rounded-lg bg-danger/10 p-3 text-base font-semibold text-danger">
              {error}
            </p>
          )}
          <button
            onClick={submitTap}
            disabled={submitting}
            className="flex h-14 w-full items-center justify-center gap-3 rounded-lg bg-brand text-xl font-semibold text-white shadow-md disabled:opacity-70"
          >
            {submitting ? <Loader2 className="size-6 animate-spin" aria-hidden /> : <CircleCheck className="size-6" aria-hidden />}
            {t("शिकायत दर्ज करें", "Register complaint")}
          </button>
        </div>
      </section>
    </div>
  );
}
