"use client";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLanguage } from "@/components/shared/LanguageProvider";
import { getJson } from "@/lib/client/api";
import { categoryLabel } from "@/lib/i18n";
import type { WorkerTicketView } from "@/lib/types";
import { CATEGORY_ICON, IconTile } from "./Pictos";
import { StatusChip } from "./StatusChip";

const when = (iso: string, lang: "hi" | "en") =>
  new Date(iso).toLocaleDateString(lang === "en" ? "en-IN" : "hi-IN", { day: "numeric", month: "short" });

/** Load this worker's tickets once (null while loading, [] on error). Pass false to skip loading. */
export function useMyTickets(enabled = true) {
  const [tickets, setTickets] = useState<WorkerTicketView[] | null>(null);
  useEffect(() => {
    if (!enabled) return;
    getJson<{ tickets: WorkerTicketView[] }>("/api/grievances")
      .then((r) => setTickets(r.tickets))
      .catch(() => setTickets([]));
  }, [enabled]);
  return tickets;
}

/** "My logged grievances" list — shown right below the recorder. */
export function MyRecentTickets({ tickets: given, limit = 3 }: { tickets?: WorkerTicketView[] | null; limit?: number }) {
  // Only fetch when the page didn't already pass the list in (the home page does).
  const own = useMyTickets(given === undefined);
  const tickets = given !== undefined ? given : own;
  const shown = tickets?.slice(0, limit) ?? [];
  const { lang, t } = useLanguage();

  return (
    <div className="space-y-3">
      {!tickets && <p className="py-3 text-center text-base text-ink-soft">{t("लोड हो रहा है…", "Loading…")}</p>}
      {tickets?.length === 0 && (
        <p className="rounded-xl border border-line bg-white p-4 text-center text-base text-ink-soft">
          {t("अभी कोई शिकायत दर्ज नहीं है। ऊपर लाल माइक दबाकर बोलें।", "No complaints yet. Press the red mic above and speak.")}
        </p>
      )}
      <ul className="space-y-3">
        {shown.map((tk) => (
          <li key={tk.id}>
            <Link
              href={`/ticket/${tk.token}`}
              className="flex items-center gap-3 rounded-xl border border-line bg-white p-3 shadow-sm transition hover:shadow-md active:scale-[0.99]"
            >
              <IconTile icon={CATEGORY_ICON[tk.category]} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="text-xl font-bold tracking-wider">{tk.token}</span>
                  <span className="text-sm text-ink-soft">{when(tk.createdAt, lang)}</span>
                </span>
                <span className="block truncate text-base text-ink">
                  {categoryLabel(tk.category, t)} · {lang === "en" ? tk.locationEn : tk.location}
                </span>
                <span className="mt-1 block">
                  <StatusChip status={tk.status} />
                </span>
              </span>
              <ChevronRight className="size-6 shrink-0 text-ink-soft" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      {tickets && tickets.length > limit && (
        <Link href="/history" className="mx-auto flex w-fit items-center rounded-full border border-ink/30 bg-white px-6 py-2.5 text-base font-medium">
          {t("सभी देखें", "See all")}
        </Link>
      )}
    </div>
  );
}
