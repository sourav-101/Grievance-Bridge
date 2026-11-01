"use client";
import { Loader2, Square, Volume2 } from "lucide-react";
import { useLanguage } from "@/components/shared/LanguageProvider";
import { useSpeech } from "@/components/shared/SpeechProvider";
import type { Dialect } from "@/lib/types";

/** Universal "सुनें" (Listen) button — reads any text aloud in the worker's dialect. */
export function SunoButton({
  text,
  id,
  dialect,
  size = "md",
  tone = "dark",
  label,
}: {
  text: string;
  id?: string;
  dialect?: Dialect;
  size?: "md" | "lg";
  tone?: "dark" | "light";
  label?: string;
}) {
  const { activeId, loadingId, speakText, stop } = useSpeech();
  const { t } = useLanguage();
  const shown = label ?? t("सुनें", "Listen");
  const stopLabel = t("रोकें", "Stop");
  const key = id ?? text.slice(0, 40);
  const playing = activeId === key;
  const loading = loadingId === key;

  const base =
    size === "lg" ? "h-14 min-w-14 px-4 text-xl gap-2 rounded-2xl" : "h-12 min-w-12 px-3 text-lg gap-2 rounded-xl";
  const colors =
    tone === "light"
      ? "bg-white/95 text-ink hover:bg-white"
      : "border border-brand bg-white text-brand hover:bg-brand/5";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        if (playing) stop();
        else void speakText(text, { id: key, dialect });
      }}
      className={`inline-flex shrink-0 items-center justify-center font-semibold transition active:scale-95 ${base} ${colors}`}
      aria-label={playing ? stopLabel : `${shown || t("सुनें", "Listen")} — ${t("ज़ोर से पढ़कर सुनाएं", "read aloud")}`}
    >
      {loading ? (
        <Loader2 className="size-6 animate-spin" aria-hidden />
      ) : playing ? (
        <Square className="size-5 fill-current" aria-hidden />
      ) : (
        <Volume2 className="size-6" aria-hidden />
      )}
      {shown && <span>{playing ? stopLabel : shown}</span>}
    </button>
  );
}
