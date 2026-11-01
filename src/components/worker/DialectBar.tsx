"use client";
import { useLanguage } from "@/components/shared/LanguageProvider";
import { DIALECTS, SITE_LANGUAGES } from "@/lib/constants";
import type { Dialect } from "@/lib/types";

/** One-tap language / dialect switch. */
export function DialectBar({ value, onChange, tone = "dark" }: { value: Dialect; onChange: (d: Dialect) => void; tone?: "dark" | "light" }) {
  const { t } = useLanguage();
  return (
    <div role="radiogroup" aria-label={t("भाषा चुनें", "Choose language")} className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
      {SITE_LANGUAGES.map((d: Dialect) => {
        const active = d === value;
        const cls =
          tone === "dark"
            ? active
              ? "bg-saffron text-ink border-saffron"
              : "bg-transparent text-paper border-paper/40 hover:border-paper"
            : active
              ? "bg-brand text-white border-ink"
              : "bg-white text-ink border-line hover:border-brand";
        return (
          <button
            key={d}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(d)}
            className={`h-10 shrink-0 rounded-full border-2 px-3.5 text-base font-bold transition ${cls}`}
          >
            {DIALECTS[d].labelHi}
          </button>
        );
      })}
    </div>
  );
}
