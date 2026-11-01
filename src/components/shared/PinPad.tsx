"use client";
import { Delete } from "lucide-react";
import { useEffect } from "react";
import { useLanguage } from "./LanguageProvider";

/**
 * Large on-screen number keypad for PINs and codes. Digits are shown as dots
 * (never spoken aloud). Calls onComplete as soon as `length` digits are entered.
 */
export function PinPad({
  value,
  onChange,
  length,
  onComplete,
  disabled = false,
  masked = true,
}: {
  value: string;
  onChange: (v: string) => void;
  length: number;
  onComplete?: (v: string) => void;
  disabled?: boolean;
  masked?: boolean;
}) {
  const press = (d: string) => {
    if (disabled || value.length >= length) return;
    const next = value + d;
    onChange(next);
    if (next.length === length) onComplete?.(next);
  };
  const back = () => !disabled && onChange(value.slice(0, -1));
  const { t } = useLanguage();

  // Physical keyboard support (desktop / phones with keypads).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignore keys meant for a text field (e.g. the help chat input) or shortcuts.
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="space-y-5">
      <div className="flex justify-center gap-3" aria-live="polite" aria-label={t(`${length} में से ${value.length} अंक डाले गए`, `${value.length} of ${length} digits entered`)}>
        {Array.from({ length }, (_, i) => (
          <span
            key={i}
            className={`grid h-16 place-items-center rounded-2xl border text-4xl font-bold ${length > 4 ? "w-12" : "w-16"} ${
              i < value.length ? "border-iitr bg-iitr text-white" : i === value.length ? "border-ink bg-white" : "border-line bg-white"
            }`}
          >
            {i < value.length ? (masked ? "●" : value[i]) : ""}
          </span>
        ))}
      </div>
      <div className="mx-auto grid max-w-xs grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button
            key={d}
            type="button"
            disabled={disabled}
            onClick={() => press(d)}
            className="h-18 rounded-2xl border border-line shadow-sm bg-white text-4xl font-bold shadow-sm transition active:scale-95 active:bg-paper-deep disabled:opacity-50"
          >
            {d}
          </button>
        ))}
        <span />
        <button
          type="button"
          disabled={disabled}
          onClick={() => press("0")}
          className="h-18 rounded-2xl border border-line shadow-sm bg-white text-4xl font-bold shadow-sm transition active:scale-95 active:bg-paper-deep disabled:opacity-50"
        >
          0
        </button>
        <button
          type="button"
          disabled={disabled || !value}
          onClick={back}
          aria-label={t("पिछला अंक मिटाएं", "Delete last digit")}
          className="grid h-18 place-items-center rounded-2xl bg-brand text-white transition active:scale-95 disabled:opacity-40"
        >
          <Delete className="size-9" aria-hidden />
        </button>
      </div>
    </div>
  );
}
