"use client";
import { Hospital, Phone, PhoneCall, ShieldCheck, UserRound, X, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useLanguage } from "@/components/shared/LanguageProvider";
import { useSpeech } from "@/components/shared/SpeechProvider";
import { getJson } from "@/lib/client/api";
import { spokenFor } from "@/lib/i18n/prompts";
import type { Helpline } from "@/lib/types";
import { SunoButton } from "./SunoButton";

const KIND_STYLE: Record<Helpline["kind"], { icon: LucideIcon; cls: string }> = {
  medical: { icon: Hospital, cls: "bg-danger text-white" },
  security: { icon: ShieldCheck, cls: "bg-iitr text-white" },
  women: { icon: UserRound, cls: "bg-indigo text-white" },
  other: { icon: PhoneCall, cls: "bg-ink text-white" },
};

/** National numbers shown when the helplines list cannot be loaded (offline, server down). */
const FALLBACK_LINES: Helpline[] = [
  { id: "fb-112", kind: "other", name_hindi: "राष्ट्रीय आपातकालीन नंबर", name_english: "National Emergency", phone: "112", instructions_hindi: "पुलिस, आग या किसी भी बड़ी आपात स्थिति में 112 पर फ़ोन करें। यह मुफ़्त है।", instructions_english: "For police, fire or any serious emergency, call 112. It is free.", is_placeholder: false, sort_order: 1 },
  { id: "fb-108", kind: "medical", name_hindi: "एम्बुलेंस", name_english: "Ambulance", phone: "108", instructions_hindi: "गंभीर बीमारी या दुर्घटना में मुफ़्त एम्बुलेंस के लिए 108 पर फ़ोन करें।", instructions_english: "For a serious illness or accident, call 108 for a free ambulance.", is_placeholder: false, sort_order: 2 },
  { id: "fb-181", kind: "women", name_hindi: "महिला हेल्पलाइन", name_english: "Women Helpline", phone: "181", instructions_hindi: "महिलाओं के लिए 24 घंटे मुफ़्त सहायता नंबर 181 है।", instructions_english: "181 is a free 24-hour helpline for women.", is_placeholder: false, sort_order: 3 },
];

/** High-contrast emergency helplines with audio instructions and one-tap calling. */
export function EmergencyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [lines, setLines] = useState<Helpline[] | null>(null);
  const [failed, setFailed] = useState(false);
  const { speakText, stop } = useSpeech();
  const { dialect, lang, t } = useLanguage();
  const english = lang === "en";

  useEffect(() => {
    if (!open) return;
    void speakText(spokenFor(dialect).emergency, { id: "emergency-intro" });
    if (!lines || failed) {
      getJson<{ helplines: Helpline[] }>("/api/helplines")
        .then((r) => {
          setFailed(false);
          setLines(r.helplines.length ? r.helplines : FALLBACK_LINES);
        })
        .catch(() => {
          setFailed(true);
          setLines(FALLBACK_LINES);
        });
    }
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/70 sm:items-center" onClick={() => { stop(); onClose(); }}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={t("आपातकालीन नंबर", "Emergency numbers")}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-paper p-5 pb-8 sm:rounded-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-3xl font-bold text-danger">{t("आपातकाल", "Emergency")}</h2>
          <button onClick={() => { stop(); onClose(); }} aria-label={t("बंद करें", "Close")} className="grid size-12 place-items-center rounded-full bg-ink text-white">
            <X className="size-7" aria-hidden />
          </button>
        </div>
        {failed && <p className="mb-3 rounded-xl bg-danger/10 p-3 text-lg font-bold text-danger">{t("कैंपस के नंबर लोड नहीं हुए। नीचे दिए राष्ट्रीय नंबर पर फ़ोन करें।", "Campus numbers could not be loaded. Call the national numbers below.")}</p>}
        <ul className="space-y-3">
          {(lines ?? []).map((h) => {
            const style = KIND_STYLE[h.kind];
            return (
              <li key={h.id} className="rounded-2xl border border-line shadow-sm bg-white p-3">
                <div className="flex items-center gap-3">
                  <style.icon className="size-10 shrink-0 text-danger" strokeWidth={1.4} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-xl font-bold leading-tight">{english ? h.name_english : h.name_hindi}</p>
                    <p className="text-sm text-ink-soft">{english ? h.name_hindi : h.name_english}</p>
                  </div>
                </div>
                <p className="mt-2 text-lg leading-snug">{(english && h.instructions_english) || h.instructions_hindi}</p>
                <div className="mt-3 flex gap-2">
                  {h.is_placeholder ? (
                    <span className="flex h-14 flex-1 items-center justify-center rounded-2xl bg-line px-3 text-center text-base font-bold text-ink-soft">
                      {t("नंबर जल्द जोड़ा जाएगा", "Number will be added soon")}
                    </span>
                  ) : (
                    <a href={`tel:${h.phone.replace(/[^\d+]/g, "")}`} className={`flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl text-2xl font-bold ${style.cls}`}>
                      <Phone className="size-7" aria-hidden /> {h.phone}
                    </a>
                  )}
                  <SunoButton text={english ? `${h.name_english}. ${h.instructions_english || h.instructions_hindi}` : `${h.name_hindi}। ${h.instructions_hindi}`} id={`help-${h.id}`} size="lg" />
                </div>
              </li>
            );
          })}
          {!lines && !failed && <li className="py-6 text-center text-lg">{t("लोड हो रहा है…", "Loading…")}</li>}
        </ul>
      </section>
    </div>
  );
}
