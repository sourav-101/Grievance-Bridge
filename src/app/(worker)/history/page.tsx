"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLanguage } from "@/components/shared/LanguageProvider";
import { FeedbackRecorder } from "@/components/worker/FeedbackRecorder";
import { CategoryPicto, HistoryPicto } from "@/components/worker/Pictos";
import { StatusChip } from "@/components/worker/StatusChip";
import { SunoButton } from "@/components/worker/SunoButton";
import { getJson } from "@/lib/client/api";
import { categoryLabel } from "@/lib/i18n";
import { statusSpeech } from "@/lib/grievances/ticket-speech";
import type { WorkerTicketView } from "@/lib/types";

/** "मेरा इतिहास" — all active and resolved tickets, with spoken resolution notes and feedback. */
export default function HistoryPage() {
  const [tickets, setTickets] = useState<WorkerTicketView[] | null>(null);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<"active" | "resolved">("active");
  const { lang, t } = useLanguage();
  const english = lang === "en";

  useEffect(() => {
    getJson<{ tickets: WorkerTicketView[] }>("/api/grievances")
      .then((r) => setTickets(r.tickets))
      .catch(() => setError(true));
  }, []);

  const active = tickets?.filter((tk) => tk.status !== "Resolved") ?? [];
  const resolved = tickets?.filter((tk) => tk.status === "Resolved") ?? [];
  const list = tab === "active" ? active : resolved;

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <h1 className="flex items-center gap-3 text-3xl font-bold leading-tight">
        <HistoryPicto className="size-14 shrink-0" /> {t("मेरा इतिहास और शिकायतें", "My history and complaints")}
      </h1>

      <div role="tablist" className="grid grid-cols-2 gap-2 rounded-2xl bg-paper-deep p-1.5">
        {(
          [
            ["active", `${t("चल रही", "Open")} (${active.length})`],
            ["resolved", `${t("हल हुई", "Resolved")} (${resolved.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`h-14 rounded-xl text-xl font-bold ${tab === key ? "bg-brand text-white" : "text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="rounded-xl bg-danger/10 p-3 text-lg font-bold text-danger">{t("इतिहास लोड नहीं हुआ।", "Could not load your history.")}</p>}
      {!tickets && !error && <p className="py-8 text-center text-xl">{t("लोड हो रहा है…", "Loading…")}</p>}
      {tickets && list.length === 0 && (
        <p className="rounded-2xl bg-white p-5 text-xl">{tab === "active" ? t("कोई चल रही शिकायत नहीं है।", "No open complaints.") : t("अभी कोई शिकायत हल नहीं हुई है।", "No complaints resolved yet.")}</p>
      )}

      <ul className="space-y-3">
        {list.map((tk) => (
          <li key={tk.id} className="space-y-3 rounded-xl border border-line shadow-sm bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-ink-soft">{t("टोकन", "Token")}</p>
                <p className="text-4xl font-bold tracking-[0.15em]">{tk.token}</p>
              </div>
              <SunoButton text={statusSpeech(tk, english)} id={`hist-${tk.id}`} />
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusChip status={tk.status} />
              {tk.isAnonymous && <span className="rounded-full bg-sec-rights px-3 py-1 text-base font-bold text-white">{t("गुमनाम", "Anonymous")}</span>}
            </div>
            <p className="flex items-center gap-2 text-xl font-bold">
              <CategoryPicto category={tk.category} className="size-10 shrink-0" />
              {categoryLabel(tk.category, t)} · {english ? tk.locationEn : tk.location}
            </p>
            <p className="text-lg text-ink-soft">“{tk.summaryHindi}”</p>
            {tk.resolutionNoteHindi && (
              <div className="rounded-2xl bg-paper p-3">
                <p className="text-base font-bold">{t("एस्टेट ऑफिस का संदेश:", "Message from the Estate Office:")}</p>
                <p className="text-xl">{tk.resolutionNoteHindi}</p>
              </div>
            )}
            {tk.status === "Resolved" && !tk.feedbackGiven && (
              <FeedbackRecorder
                grievanceId={tk.id}
                onDone={() => setTickets((prev) => prev?.map((x) => (x.id === tk.id ? { ...x, feedbackGiven: true } : x)) ?? prev)}
              />
            )}
            {tk.status === "Resolved" && tk.feedbackGiven && <p className="text-base font-bold text-ok">{t("आपकी राय मिल गई, धन्यवाद।", "Thank you, we got your feedback.")}</p>}
            <Link href={`/ticket/${tk.token}`} className="inline-block text-lg font-bold underline">
              {t("रसीद / QR देखें →", "View receipt / QR →")}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
