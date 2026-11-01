"use client";
import { AudioLines, CircleCheck, Mic } from "lucide-react";
import type { ReactNode } from "react";
import { useLanguage } from "@/components/shared/LanguageProvider";
import type { useVoiceAgent } from "@/hooks/useVoiceAgent";
import { MicButton } from "./MicButton";
import { IconTile } from "./Pictos";
import { SunoButton } from "./SunoButton";

const HOW_TO_HI =
  "शिकायत करने के तीन आसान कदम। पहला: लाल माइक बटन दबाएं। दूसरा: अपनी समस्या और जगह बोलें, फिर बटन दोबारा दबाएं। तीसरा: जांच कर के हरा बटन दबाएं। आपको एक टोकन नंबर मिलेगा।";

const HOW_TO_EN =
  "Three easy steps to complain. First: press the red mic button. Second: say your problem and the place, then press the button again. Third: check and press the green button. You will get a token number.";

const STEPS = [
  { icon: Mic, label: "माइक दबाएं", en: "Press mic" },
  { icon: AudioLines, label: "समस्या बोलें", en: "Say problem" },
  { icon: CircleCheck, label: "पुष्टि करें", en: "Confirm" },
];

/** "Log current grievance": white card with a 3-step guide and the red recorder. */
export function GrievanceRecorderCard({
  voice,
  children,
}: {
  voice: ReturnType<typeof useVoiceAgent>;
  children?: ReactNode;
}) {
  const { t } = useLanguage();
  return (
    <section aria-label={t("शिकायत रिकॉर्ड करें", "Record a complaint")} className="rounded-xl bg-white p-4 shadow-md sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <ol className="grid flex-1 grid-cols-3 gap-2" aria-label={t("शिकायत करने के कदम", "Steps to complain")}>
          {STEPS.map(({ icon, label, en }, i) => (
            <li key={label} className="flex flex-col items-center gap-1.5 text-center">
              <span className="relative">
                <IconTile icon={icon} size="md" />
                <span className="absolute -left-1.5 -top-1.5 grid size-6 place-items-center rounded-full bg-ink text-xs font-bold text-white">{i + 1}</span>
              </span>
              <span className="text-sm font-semibold leading-tight text-ink">{t(label, en)}</span>
            </li>
          ))}
        </ol>
        <SunoButton text={t(HOW_TO_HI, HOW_TO_EN)} id="how-to-complain" label="" />
      </div>

      <div className="mt-5 flex flex-col items-center gap-3">
        <MicButton
          isRecording={voice.isRecording}
          busy={voice.busy}
          level={voice.level}
          elapsed={voice.elapsed}
          onClick={voice.toggle}
          size={96}
          idleLabel={t("दबाकर बोलें", "Press and speak")}
          tone="red"
        />
        <p className="text-center text-base text-ink-soft">{t("जैसे: “गोविंद भवन में दो दिन से पानी नहीं आ रहा।”", "For example: “No water in Govind Bhawan for two days.”")}</p>
        {voice.error && (
          <p role="alert" className="w-full rounded-lg bg-danger/10 p-3 text-center text-base font-semibold text-danger">
            {voice.error}
          </p>
        )}
        {voice.result && voice.result.type !== "grievance_draft" && (
          <p className="w-full rounded-lg bg-paper p-3 text-base">{voice.result.speech.text}</p>
        )}
        {children}
      </div>
    </section>
  );
}
