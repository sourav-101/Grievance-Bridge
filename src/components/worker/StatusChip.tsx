"use client";
import { CircleCheck, CirclePlus, Search, Wrench, type LucideIcon } from "lucide-react";
import { useLanguage } from "@/components/shared/LanguageProvider";
import { statusLabel } from "@/lib/i18n";
import type { GrievanceStatus } from "@/lib/types";

const STYLES: Record<GrievanceStatus, string> = {
  New: "bg-indigo/10 text-indigo ring-indigo/30",
  "Under Review": "bg-orange/10 text-saffron-deep ring-orange/30",
  "In Progress": "bg-iitr/10 text-iitr ring-iitr/30",
  Resolved: "bg-ok/10 text-ok ring-ok/30",
};
const ICONS: Record<GrievanceStatus, LucideIcon> = { New: CirclePlus, "Under Review": Search, "In Progress": Wrench, Resolved: CircleCheck };

export function StatusChip({ status, large = false }: { status: GrievanceStatus; large?: boolean }) {
  const Icon = ICONS[status];
  const { t } = useLanguage();
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold ring-1 ${STYLES[status]} ${large ? "px-4 py-1.5 text-lg" : "px-2.5 py-0.5 text-sm"}`}>
      <Icon className={large ? "size-5" : "size-4"} aria-hidden />
      {statusLabel(status, t)}
    </span>
  );
}

/** Four-step progress: New → Review → Progress → Resolved. */
export function StatusSteps({ status }: { status: GrievanceStatus }) {
  const order: GrievanceStatus[] = ["New", "Under Review", "In Progress", "Resolved"];
  const idx = order.indexOf(status);
  const { t } = useLanguage();
  return (
    <ol className="flex items-center gap-1" aria-label={`${t("स्थिति", "Status")}: ${statusLabel(status, t)}`}>
      {order.map((s, i) => {
        const Icon = ICONS[s];
        return (
          <li key={s} className="flex flex-1 items-center gap-1">
            <span className={`grid size-8 shrink-0 place-items-center rounded-full ${i <= idx ? "bg-brand text-white" : "bg-paper-deep text-ink-soft"}`}>
              <Icon className="size-4" aria-hidden />
            </span>
            {i < order.length - 1 && <span className={`h-1 flex-1 rounded ${i < idx ? "bg-brand" : "bg-line"}`} />}
          </li>
        );
      })}
    </ol>
  );
}
