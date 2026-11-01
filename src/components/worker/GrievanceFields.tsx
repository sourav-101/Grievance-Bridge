"use client";
import { useLanguage } from "@/components/shared/LanguageProvider";
import { CAMPUS_ZONES } from "@/lib/campus";
import { GRIEVANCE_CATEGORY_IDS } from "@/lib/constants";
import { categoryLabel } from "@/lib/i18n";
import type { GrievanceCategory } from "@/lib/types";
import { AnonymousPicto, CategoryPicto } from "./Pictos";

export function CategoryPicker({ value, onChange }: { value: GrievanceCategory | null; onChange: (c: GrievanceCategory) => void }) {
  const { lang, t } = useLanguage();
  return (
    <div role="radiogroup" aria-label={t("समस्या चुनें", "Choose the problem")} className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {GRIEVANCE_CATEGORY_IDS.map((c) => {
        const active = value === c;
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(c)}
            className={`flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl border p-3 text-center transition active:scale-[0.97] ${
              active ? "border-brand bg-brand/5 text-brand ring-2 ring-brand" : "border-line bg-white text-ink hover:border-brand"
            }`}
          >
            <span className={`grid size-16 place-items-center rounded-xl p-1 ${active ? "bg-white" : ""}`}>
              <CategoryPicto category={c} className="size-full" />
            </span>
            <span className="text-lg font-bold leading-tight">{categoryLabel(c, t)}</span>
          </button>
        );
      })}
    </div>
  );
}

const GROUPS: { type: string; label: string; en: string }[] = [
  { type: "hostel", label: "छात्रावास (हॉस्टल)", en: "Hostels" },
  { type: "academic", label: "पढ़ाई की इमारतें", en: "Academic buildings" },
  { type: "admin", label: "दफ़्तर", en: "Offices" },
  { type: "health", label: "अस्पताल", en: "Hospital" },
  { type: "facility", label: "अन्य जगहें", en: "Other places" },
  { type: "residential", label: "आवासीय", en: "Residential" },
  { type: "other", label: "अन्य", en: "Other" },
];

export function ZoneSelect({ value, onChange }: { value: string | null; onChange: (id: string) => void }) {
  const { t } = useLanguage();
  return (
    <label className="block">
      <span className="mb-1.5 block text-lg font-bold">{t("जगह", "Place")}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="h-14 w-full rounded-2xl border border-line bg-white px-3 text-xl font-semibold text-ink focus:border-ink"
      >
        <option value="" disabled>
          {t("जगह चुनें…", "Choose a place…")}
        </option>
        {GROUPS.map((g) => (
          <optgroup key={g.type} label={t(g.label, g.en)}>
            {CAMPUS_ZONES.filter((z) => z.type === g.type).map((z) => (
              <option key={z.id} value={z.id}>
                {t(z.nameHi, z.nameEn)}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

/** Whistleblower mode toggle. */
export function AnonymousToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const { t } = useLanguage();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
        value ? "border-sec-rights bg-sec-rights text-white" : "border-line bg-white text-ink"
      }`}
    >
      <span className={`grid size-14 shrink-0 place-items-center rounded-xl p-1 ${value ? "bg-white" : "bg-paper-deep"}`}>
        <AnonymousPicto className="size-full" />
      </span>
      <span className="flex-1">
        <span className="block text-xl font-bold">{value ? t("गुमनाम शिकायत: चालू", "Anonymous complaint: ON") : t("गुमनाम शिकायत: बंद", "Anonymous complaint: OFF")}</span>
        <span className={`block text-base ${value ? "text-white/90" : "text-ink-soft"}`}>
          {value
            ? t("आपका नाम, नंबर और आवाज़ किसी अधिकारी या ठेकेदार को नहीं दिखेगी।", "Your name, number and voice will not be shown to any official or contractor.")
            : t("वेतन चोरी, रिश्वत या खतरे की शिकायत में नाम छुपाने के लिए चालू करें।", "Turn on to hide your name in complaints about unpaid wages, bribes or danger.")}
        </span>
      </span>
      <span className={`relative h-8 w-14 shrink-0 rounded-full ${value ? "bg-white" : "bg-line"}`} aria-hidden>
        <span className={`absolute top-1 size-6 rounded-full transition-all ${value ? "left-7 bg-sec-rights" : "left-1 bg-white"}`} />
      </span>
    </button>
  );
}
