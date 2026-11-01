"use client";
import { Check, Languages } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DIALECTS, SITE_LANGUAGES } from "@/lib/constants";
import type { Dialect } from "@/lib/types";
import { useLanguage } from "./LanguageProvider";

/** "अ/A" toolbar button: pick Hindi or English. */
export function LanguageMenu({ onChange }: { onChange?: (d: Dialect) => void }) {
  const { dialect, setDialect, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={t(`भाषा बदलें — अभी: ${DIALECTS[dialect].labelHi}`, `Change language — now: ${DIALECTS[dialect].labelEn}`)}
        className="flex h-12 flex-col items-center justify-center rounded-lg px-2 text-ink"
      >
        <Languages className="size-6" strokeWidth={1.7} aria-hidden />
        <span className="text-[11px] font-medium">{DIALECTS[dialect].labelHi}</span>
      </button>
      {open && (
        <ul className="absolute right-0 top-13 z-40 w-48 overflow-hidden rounded-xl border border-line bg-white py-1 shadow-xl" role="listbox" aria-label={t("भाषा चुनें", "Choose language")}>
          {SITE_LANGUAGES.map((d) => (
            <li key={d}>
              <button
                role="option"
                aria-selected={d === dialect}
                onClick={() => {
                  setDialect(d);
                  onChange?.(d);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between px-4 py-3 text-left text-base ${d === dialect ? "font-semibold text-brand" : "text-ink"}`}
              >
                <span>{DIALECTS[d].labelHi}</span>
                {d === dialect && <Check className="size-5" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
