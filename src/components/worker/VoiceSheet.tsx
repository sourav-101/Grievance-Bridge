"use client";
import { CategoryPicto } from "./Pictos";
import { Globe, BookOpen, X } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { useLanguage } from "@/components/shared/LanguageProvider";
import { useSpeech } from "@/components/shared/SpeechProvider";
import { categoryLabel } from "@/lib/i18n";
import { GrievanceConfirm } from "./GrievanceConfirm";
import { StatusChip } from "./StatusChip";
import { useWorker } from "./WorkerProvider";

/** Bottom sheet with the dual output of a voice query: visual card + spoken audio. */
export function VoiceSheet() {
  const { result, showResult } = useWorker();
  const { play, activeId, stop } = useSpeech();
  const { lang, t } = useLanguage();

  useEffect(() => {
    if (!result) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && showResult(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [result, showResult]);

  if (!result) return null;
  const close = () => {
    stop();
    showResult(null);
  };
  const playing = activeId === "voice-result";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 sm:items-center" onClick={close}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={t("जवाब", "Answer")}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-paper p-5 pb-8 shadow-2xl sm:rounded-xl"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <p className="text-base text-ink-soft">
            {result.transcript && result.type !== "grievance_draft" ? (
              <>
                <span className="font-bold">{t("आपने कहा: ", "You said: ")}</span>“{result.transcript}”
              </>
            ) : (
              " "
            )}
          </p>
          <button onClick={close} aria-label={t("बंद करें", "Close")} className="grid size-12 shrink-0 place-items-center rounded-full bg-brand text-white">
            <X className="size-7" aria-hidden />
          </button>
        </div>

        {result.type === "answer" && (
          <article className="rounded-2xl border border-line shadow-sm bg-white p-4">
            <h2 className="text-2xl font-bold leading-tight">{result.card.title}</h2>
            <p className="mt-2 text-xl leading-relaxed">{result.card.text}</p>
            <p className="mt-3 flex items-center gap-1.5 text-sm text-ink-soft">
              {result.card.source === "web" ? <Globe className="size-4" aria-hidden /> : <BookOpen className="size-4" aria-hidden />}
              {result.card.source === "web"
                ? t("इंटरनेट से ताज़ा जानकारी", "Latest information from the internet")
                : result.card.source === "rag"
                  ? t("IIT रुड़की जानकारी भंडार से", "From the IIT Roorkee knowledge base")
                  : t("पक्की जानकारी नहीं मिली", "No confirmed information found")}
            </p>
            {result.card.source === "web" && result.card.references.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-sm">
                {result.card.references.map((r) =>
                  r.url ? (
                    <li key={r.url}>
                      <a href={r.url} target="_blank" rel="noreferrer" className="text-sec-schemes underline">
                        {r.title}
                      </a>
                    </li>
                  ) : null,
                )}
              </ul>
            )}
          </article>
        )}

        {result.type === "grievance_draft" && (
          <GrievanceConfirm draft={result.draft} transcript={result.transcript} onDone={() => showResult(null)} />
        )}

        {result.type === "status" &&
          (result.ticket ? (
            <article className="rounded-2xl border border-line shadow-sm bg-white p-4">
              <p className="text-lg font-bold text-ink-soft">{t("टोकन", "Token")}</p>
              <p className="text-5xl font-bold tracking-[0.2em]">{result.ticket.token}</p>
              <p className="mt-2 text-xl font-bold">
                <CategoryPicto category={result.ticket.category} className="mr-1 inline size-9 align-middle" />
                {categoryLabel(result.ticket.category, t)}
              </p>
              <div className="mt-3">
                <StatusChip status={result.ticket.status} large />
              </div>
              {result.ticket.resolutionNoteHindi && <p className="mt-3 rounded-xl bg-paper p-3 text-lg">{result.ticket.resolutionNoteHindi}</p>}
              {result.isOwner && (
                <Link href={`/ticket/${result.ticket.token}`} onClick={() => showResult(null)} className="mt-3 inline-block text-lg font-bold underline">
                  {t("पूरी रसीद देखें →", "View full receipt →")}
                </Link>
              )}
            </article>
          ) : (
            <p className="rounded-2xl bg-white p-4 text-xl">{result.speech.text}</p>
          ))}

        {(result.type === "help" || result.type === "empty") && (
          <p className="rounded-2xl bg-white p-4 text-xl leading-relaxed">{result.speech.text}</p>
        )}

        <button
          onClick={() => (playing ? stop() : void play(result.speech, "voice-result"))}
          className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-brand text-xl font-bold text-white"
        >
          {playing ? t("रोकें", "Stop") : t("फिर से सुनें", "Listen again")}
        </button>
      </section>
    </div>
  );
}
