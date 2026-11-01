"use client";
import { Loader2, ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "@/components/shared/LanguageProvider";
import { useSpeech } from "@/components/shared/SpeechProvider";
import { useRecorder } from "@/hooks/useRecorder";
import { ApiError, audioForm, postForm } from "@/lib/client/api";
import { FEEDBACK_RECORDING_SECONDS } from "@/lib/constants";
import type { SpeechPayload } from "@/lib/types";
import { MicButton } from "./MicButton";
import { useWorker } from "./WorkerProvider";

/** After resolution: thumbs up / down or a 10-second spoken rating. */
export function FeedbackRecorder({ grievanceId, onDone }: { grievanceId: string; onDone: (rating: string) => void }) {
  const recorder = useRecorder(FEEDBACK_RECORDING_SECONDS);
  const { play } = useSpeech();
  const { dialect } = useWorker();
  const { t } = useLanguage();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(rating?: "Satisfied" | "Unsatisfied", audio?: Blob) {
    setSending(true);
    setError(null);
    try {
      const form = audio ? audioForm(audio) : new FormData();
      form.append("grievanceId", grievanceId);
      form.append("dialect", dialect);
      if (rating) form.append("rating", rating);
      const r = await postForm<{ rating: string; speech: SpeechPayload }>("/api/feedback", form);
      void play(r.speech, "feedback");
      onDone(r.rating);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("राय नहीं भेजी जा सकी।", "Could not send your feedback."));
    } finally {
      setSending(false);
    }
  }

  async function record() {
    if (recorder.isRecording) return recorder.stop();
    const blob = await recorder.start();
    if (blob) await send(undefined, blob);
  }

  return (
    <div className="space-y-3 rounded-2xl bg-paper p-3">
      <p className="text-lg font-bold">{t("क्या आप समाधान से संतुष्ट हैं?", "Are you happy with how it was fixed?")}</p>
      <div className="grid grid-cols-2 gap-2">
        <button
          disabled={sending}
          onClick={() => send("Satisfied")}
          className="flex h-16 items-center justify-center gap-2 rounded-2xl bg-ok text-xl font-bold text-white disabled:opacity-60"
        >
          <ThumbsUp className="size-7" aria-hidden /> {t("हाँ", "Yes")}
        </button>
        <button
          disabled={sending}
          onClick={() => send("Unsatisfied")}
          className="flex h-16 items-center justify-center gap-2 rounded-2xl bg-danger text-xl font-bold text-white disabled:opacity-60"
        >
          <ThumbsDown className="size-7" aria-hidden /> {t("नहीं", "No")}
        </button>
      </div>
      <div className="flex items-center gap-3">
        <MicButton
          isRecording={recorder.isRecording}
          busy={sending || recorder.state === "processing"}
          level={recorder.level}
          elapsed={recorder.elapsed}
          onClick={record}
          size={64}
          maxSeconds={FEEDBACK_RECORDING_SECONDS}
          idleLabel={t("10 सेकंड बोलें", "Speak 10 sec")}
        />
        <p className="text-base text-ink-soft">{t("या बोलकर बताएं कि काम ठीक हुआ या नहीं।", "Or say whether the work was done properly.")}</p>
      </div>
      {sending && (
        <p className="flex items-center gap-2 text-lg">
          <Loader2 className="size-5 animate-spin" aria-hidden /> {t("भेज रहे हैं…", "Sending…")}
        </p>
      )}
      {(error || recorder.error) && <p className="text-lg font-bold text-danger">{error || recorder.error}</p>}
    </div>
  );
}
