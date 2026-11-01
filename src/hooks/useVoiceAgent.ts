"use client";
import { useCallback, useState } from "react";
import { useLanguage } from "@/components/shared/LanguageProvider";
import { useSpeech } from "@/components/shared/SpeechProvider";
import { useWorker, type VoiceResult } from "@/components/worker/WorkerProvider";
import { ApiError, audioForm, postForm } from "@/lib/client/api";
import { MAX_RECORDING_SECONDS } from "@/lib/constants";
import { useRecorder } from "./useRecorder";

/**
 * Record → /api/voice-agent → auto-play the spoken answer and either open the
 * global result sheet, or (inline mode) keep the result for the calling page.
 */
export function useVoiceAgent(context: "global" | "grievance" = "global", opts: { inline?: boolean } = {}) {
  const inline = Boolean(opts.inline);
  const [result, setResult] = useState<VoiceResult | null>(null);
  const recorder = useRecorder(MAX_RECORDING_SECONDS);
  const { dialect, showResult } = useWorker();
  const { play, stop: stopSpeech } = useSpeech();
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useLanguage();

  const toggle = useCallback(async () => {
    if (recorder.isRecording) {
      recorder.stop();
      return;
    }
    if (thinking) return;
    stopSpeech();
    setError(null);
    const blob = await recorder.start();
    if (!blob) return;
    setThinking(true);
    try {
      const res = await postForm<VoiceResult>("/api/voice-agent", audioForm(blob, { dialect, context }));
      if (inline) setResult(res);
      else showResult(res);
      void play(res.speech, "voice-result");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("नेटवर्क की समस्या। फिर से कोशिश करें।", "Network problem. Please try again."));
    } finally {
      setThinking(false);
    }
  }, [context, dialect, inline, play, recorder, showResult, stopSpeech, t, thinking]);

  return {
    toggle,
    result,
    clearResult: () => setResult(null),
    thinking,
    error: error ?? recorder.error,
    isRecording: recorder.isRecording,
    level: recorder.level,
    elapsed: recorder.elapsed,
    busy: thinking || recorder.state === "processing" || recorder.state === "requesting",
  };
}
