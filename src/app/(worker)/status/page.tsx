"use client";
import { CategoryPicto } from "@/components/worker/Pictos";
import { Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/components/shared/LanguageProvider";
import { useSpeech } from "@/components/shared/SpeechProvider";
import { MicButton } from "@/components/worker/MicButton";
import { StatusChip, StatusSteps } from "@/components/worker/StatusChip";
import { useWorker } from "@/components/worker/WorkerProvider";
import { useRecorder } from "@/hooks/useRecorder";
import { ApiError, audioForm, getJson, postForm } from "@/lib/client/api";
import { categoryLabel } from "@/lib/i18n";
import type { SpeechPayload, WorkerTicketView } from "@/lib/types";

function StatusSearch() {
  const initial = useSearchParams().get("token") ?? "";
  const [token, setToken] = useState(initial.replace(/\D/g, "").slice(0, 6));
  const [ticket, setTicket] = useState<WorkerTicketView | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const recorder = useRecorder(10);
  const { play } = useSpeech();
  const { dialect } = useWorker();
  const { lang, t, ready } = useLanguage();

  const lookup = useCallback(
    async (tok: string) => {
      if (!/^\d{4,6}$/.test(tok)) {
        setMessage(t("कृपया 4 अंकों का टोकन नंबर डालें।", "Please enter the 4 digit token number."));
        return;
      }
      setLoading(true);
      setMessage(null);
      try {
        const r = await getJson<{ ticket: WorkerTicketView; speech: SpeechPayload }>(
          `/api/tickets/status?token=${tok}&speak=1&dialect=${dialect}`,
        );
        setTicket(r.ticket);
        if (r.speech) void play(r.speech, "status");
      } catch (e) {
        setTicket(null);
        const speech = e instanceof ApiError ? (e.data.speech as SpeechPayload | undefined) : undefined;
        setMessage(e instanceof ApiError && e.status === 404 ? t("इस टोकन नंबर की कोई शिकायत नहीं मिली।", "No complaint found with this token number.") : e instanceof ApiError ? e.message : t("नेटवर्क की समस्या।", "Network problem."));
        if (speech) void play(speech, "status");
      } finally {
        setLoading(false);
      }
    },
    [dialect, play, t],
  );

  // Look up a token from the link (QR code) once the saved language is known,
  // so the result and its spoken status come back in that language.
  useEffect(() => {
    if (ready && initial) void lookup(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  async function speakToken() {
    if (recorder.isRecording) return recorder.stop();
    const blob = await recorder.start();
    if (!blob) return;
    setLoading(true);
    try {
      const r = await postForm<{ transcript: string; token: string | null }>("/api/stt", audioForm(blob));
      if (r.token) {
        setToken(r.token);
        await lookup(r.token);
      } else {
        setMessage(t(`नंबर समझ नहीं आया (“${r.transcript}”)। कृपया एक-एक अंक धीरे बोलें।`, `Could not understand the number (“${r.transcript}”). Please say each digit slowly.`));
        setLoading(false);
      }
    } catch (e) {
      setMessage(e instanceof ApiError ? e.message : t("नेटवर्क की समस्या।", "Network problem."));
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <h1 className="text-3xl font-bold">{t("टोकन से स्थिति जानें", "Check status by token")}</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void lookup(token);
        }}
        className="flex gap-2"
      >
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={token}
          onChange={(e) => setToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder={t("टोकन", "Token")}
          aria-label={t("टोकन नंबर", "Token number")}
          className="h-16 min-w-0 flex-1 rounded-2xl border border-line shadow-sm bg-white px-4 text-center text-4xl font-bold tracking-[0.3em]"
        />
        <button type="submit" disabled={loading} aria-label={t("खोजें", "Search")} className="grid h-16 w-16 place-items-center rounded-2xl bg-brand text-white disabled:opacity-60">
          <Search className="size-8" aria-hidden />
        </button>
      </form>

      <div className="flex flex-col items-center gap-2 rounded-xl bg-white p-4">
        <p className="text-lg font-bold">{t("या टोकन नंबर बोलें", "Or say the token number")}</p>
        <MicButton
          isRecording={recorder.isRecording}
          busy={loading || recorder.state === "processing"}
          level={recorder.level}
          elapsed={recorder.elapsed}
          onClick={speakToken}
          maxSeconds={10}
          idleLabel={t("नंबर बोलें", "Say number")}
        />
        {recorder.error && <p className="text-lg font-bold text-danger">{recorder.error}</p>}
      </div>

      {message && <p role="alert" className="rounded-2xl bg-danger/10 p-4 text-xl font-bold text-danger">{message}</p>}

      {ticket && (
        <article className="space-y-3 rounded-xl border border-line shadow-sm bg-white p-5">
          <p className="text-6xl font-bold tracking-[0.18em]">{ticket.token}</p>
          <StatusSteps status={ticket.status} />
          <StatusChip status={ticket.status} large />
          <p className="text-xl">
            <CategoryPicto category={ticket.category} className="mr-1 inline size-9 align-middle" />
            {categoryLabel(ticket.category, t)}
            {ticket.location !== "—" && ` · ${lang === "en" ? ticket.locationEn : ticket.location}`}
          </p>
          {ticket.resolutionNoteHindi && <p className="rounded-2xl bg-paper p-3 text-xl">{ticket.resolutionNoteHindi}</p>}
        </article>
      )}
    </div>
  );
}

export default function StatusPage() {
  return (
    <Suspense fallback={null}>
      <StatusSearch />
    </Suspense>
  );
}
