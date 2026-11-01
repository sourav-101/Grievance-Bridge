"use client";
import { Loader2, Mic, Square } from "lucide-react";
import { useLanguage } from "@/components/shared/LanguageProvider";
import { MAX_RECORDING_SECONDS } from "@/lib/constants";

/** Large round microphone button with a live voice-level pulse. */
export function MicButton({
  isRecording,
  busy,
  level,
  elapsed,
  onClick,
  size = 84,
  maxSeconds = MAX_RECORDING_SECONDS,
  idleLabel,
  tone = "saffron",
}: {
  isRecording: boolean;
  busy: boolean;
  level: number;
  elapsed: number;
  onClick: () => void;
  size?: number;
  maxSeconds?: number;
  idleLabel?: string;
  /** "red" = complaint recorder, "saffron" = ask-a-question mic. */
  tone?: "saffron" | "red";
}) {
  const { t } = useLanguage();
  const label = isRecording
    ? `${t("रोकें", "Stop")} · ${Math.max(0, Math.ceil(maxSeconds - elapsed))}`
    : busy
      ? t("सोच रहा हूँ…", "Thinking…")
      : (idleLabel ?? t("बोलें", "Speak"));
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={onClick}
        disabled={busy && !isRecording}
        aria-label={isRecording ? t("रिकॉर्डिंग रोकें", "Stop recording") : t("बोलने के लिए दबाएं", "Press to speak")}
        aria-pressed={isRecording}
        className="relative grid place-items-center rounded-full shadow-[0_10px_28px_rgba(15,118,110,0.4)] ring-1 ring-black/5 transition active:scale-95 disabled:opacity-80"
        style={{ width: size, height: size }}
      >
        {isRecording && (
          <>
            <span className="absolute inset-0 rounded-full bg-danger/40 animate-pulse-ring" aria-hidden />
            <span
              className="absolute inset-0 rounded-full bg-danger/30 transition-transform duration-75"
              style={{ transform: `scale(${1 + level * 0.45})` }}
              aria-hidden
            />
          </>
        )}
        <span
          className={`relative grid size-full place-items-center rounded-full border-4 border-white ${
            isRecording ? "bg-danger text-white" : tone === "red" ? "bg-gradient-to-br from-brand-light to-brand-dark text-white" : "bg-gradient-to-br from-indigo-soft to-indigo text-white"
          }`}
        >
          {busy && !isRecording ? (
            <Loader2 className="size-9 animate-spin" aria-hidden />
          ) : isRecording ? (
            <Square className="size-8 fill-current" aria-hidden />
          ) : (
            <Mic className="size-10" strokeWidth={2.5} aria-hidden />
          )}
        </span>
      </button>
      <span className="rounded-full bg-ink px-3 py-0.5 text-sm font-semibold text-white" aria-live="polite">
        {label}
      </span>
    </div>
  );
}
