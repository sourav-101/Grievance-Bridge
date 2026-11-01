"use client";
import { ArrowLeft, ArrowRight, Check, Construction, Loader2, Shield, SprayCan, Trees, Volume2, Wrench, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useLanguage } from "@/components/shared/LanguageProvider";
import { useSpeech } from "@/components/shared/SpeechProvider";
import { DialectBar } from "@/components/worker/DialectBar";
import { MicButton } from "@/components/worker/MicButton";
import { useRecorder } from "@/hooks/useRecorder";
import { ApiError, audioForm, getJson, postForm, sendJson } from "@/lib/client/api";
import { WORK_TYPES, WORK_TYPE_IDS } from "@/lib/constants";
import type { PublicPromptKey } from "@/lib/i18n/prompts";
import type { WorkType } from "@/lib/types";

type Step = 0 | 1 | 2 | 3;
const WORK_ICON: Record<WorkType, LucideIcon> = {
  Sanitation: SprayCan,
  Horticulture: Trees,
  Construction: Construction,
  Security: Shield,
  Maintenance: Wrench,
};
const PROMPTS: PublicPromptKey[] = ["onboarding_name", "onboarding_work", "onboarding_agency", "onboarding_dialect"];

/** First-time profile creation, voice-first: "अपना नाम और उम्र बोलें". */
export default function OnboardingPage() {
  const [step, setStep] = useState<Step>(0);
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [heard, setHeard] = useState<string | null>(null);
  const [workType, setWorkType] = useState<WorkType | null>(null);
  const [contractorId, setContractorId] = useState<string | null | "unknown">(null);
  // The language picked here (or on the login page) is the site-wide choice.
  const { dialect, setDialect, t, ready } = useLanguage();
  const [contractors, setContractors] = useState<{ id: string; agency_name: string; contract_type: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRecorder(15);
  const { speakPrompt, activeId, loadingId } = useSpeech();

  // Speak each step's instruction when it appears (browsers may block the very first autoplay).
  useEffect(() => {
    if (!ready) return; // wait for the saved language
    void speakPrompt(PROMPTS[step], { id: PROMPTS[step], dialect });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, ready]);

  useEffect(() => {
    getJson<{ contractors: typeof contractors }>("/api/contractors")
      .then((r) => setContractors(r.contractors))
      .catch(() => undefined);
  }, []);

  async function recordNameAge() {
    if (recorder.isRecording) return recorder.stop();
    setError(null);
    const blob = await recorder.start();
    if (!blob) return;
    setBusy(true);
    try {
      const r = await postForm<{ transcript: string; fullName: string; age: number | null }>("/api/onboarding/voice", audioForm(blob, { dialect }));
      setHeard(r.transcript || null);
      if (r.fullName) setFullName(r.fullName);
      if (r.age) setAge(String(r.age));
      if (!r.fullName) setError(t("नाम समझ नहीं आया। फिर से बोलें या नीचे लिखें।", "Could not understand the name. Speak again or type it below."));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("आवाज़ समझ नहीं आई। नीचे लिख भी सकते हैं।", "Could not understand the voice. You can also type below."));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await sendJson("/api/profile", {
        fullName: fullName.trim(),
        age: age ? Number(age) : null,
        workType,
        contractorId: contractorId === "unknown" ? null : contractorId,
        dialect,
      });
      location.href = "/";
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("प्रोफ़ाइल सेव नहीं हुई।", "Could not save the profile."));
      setBusy(false);
    }
  }

  const canNext =
    (step === 0 && fullName.trim().length >= 2 && (!age || (Number(age) >= 14 && Number(age) <= 99))) ||
    (step === 1 && workType !== null) ||
    (step === 2 && contractorId !== null) ||
    step === 3;
  const agencies = contractors.filter((c) => !workType || c.contract_type === workType);
  const prompt = PROMPTS[step];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-lg font-bold text-ink-soft">{t("कदम", "Step")} {step + 1} / 4</p>
        <button
          onClick={() => void speakPrompt(prompt, { id: prompt, dialect })}
          className="flex h-12 items-center gap-2 rounded-xl bg-brand px-4 text-lg font-bold text-white"
        >
          {loadingId === prompt ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Volume2 className="size-5" aria-hidden />}
          {activeId === prompt ? t("सुन रहे हैं…", "Playing…") : t("फिर से सुनें", "Listen again")}
        </button>
      </div>

      {step === 0 && (
        <section className="space-y-5">
          <h1 className="text-3xl font-bold leading-tight">{t("अपना नाम और उम्र बोलें", "Say your name and age")}</h1>
          <div className="flex flex-col items-center gap-2 rounded-xl bg-white p-5">
            <MicButton
              isRecording={recorder.isRecording}
              busy={busy || recorder.state === "processing"}
              level={recorder.level}
              elapsed={recorder.elapsed}
              onClick={recordNameAge}
              size={110}
              maxSeconds={15}
              idleLabel={t("दबाकर बोलें", "Press and speak")}
            />
            {heard && <p className="text-center text-lg text-ink-soft">{t("सुना", "Heard")}: “{heard}”</p>}
            {recorder.error && <p className="text-center text-lg font-bold text-danger">{recorder.error}</p>}
          </div>
          <label className="block">
            <span className="mb-1 block text-xl font-bold">{t("नाम", "Name")}</span>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              className="h-16 w-full rounded-2xl border border-line shadow-sm bg-white px-4 text-2xl font-bold"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xl font-bold">{t("उम्र (साल)", "Age (years)")}</span>
            <input
              value={age}
              onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 2))}
              inputMode="numeric"
              className="h-16 w-40 rounded-2xl border border-line shadow-sm bg-white px-4 text-2xl font-bold"
            />
          </label>
        </section>
      )}

      {step === 1 && (
        <section className="space-y-4">
          <h1 className="text-3xl font-bold leading-tight">{t("आप क्या काम करते हैं?", "What work do you do?")}</h1>
          <div className="grid grid-cols-2 gap-3">
            {WORK_TYPE_IDS.map((w) => (
              <button
                key={w}
                onClick={() => {
                  setWorkType(w);
                  setContractorId(null);
                }}
                aria-pressed={workType === w}
                className={`flex h-32 flex-col items-center justify-center gap-1 rounded-xl border text-2xl font-bold ${
                  workType === w ? "border-brand bg-brand/5 text-brand ring-2 ring-brand" : "border-line bg-white"
                }`}
              >
                {(() => {
                  const I = WORK_ICON[w];
                  return <I className={`size-10 text-brand`} strokeWidth={1.5} aria-hidden />;
                })()}
                {t(WORK_TYPES[w].labelHi, WORK_TYPES[w].labelEn)}
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-4">
          <h1 className="text-3xl font-bold leading-tight">{t("आपकी ठेकेदार एजेंसी", "Your contractor agency")}</h1>
          <p className="text-lg text-ink-soft">{t("यह सिर्फ़ रिपोर्ट के लिए है। गुमनाम शिकायत में आपका नाम ठेकेदार को कभी नहीं दिखेगा।", "This is only for reports. In an anonymous complaint your name is never shown to the contractor.")}</p>
          <div className="space-y-2">
            {agencies.map((c) => (
              <button
                key={c.id}
                onClick={() => setContractorId(c.id)}
                aria-pressed={contractorId === c.id}
                className={`flex min-h-16 w-full items-center gap-3 rounded-2xl border px-4 text-left text-xl font-bold ${
                  contractorId === c.id ? "border-brand bg-brand/5 text-brand ring-2 ring-brand" : "border-line bg-white"
                }`}
              >
                {contractorId === c.id && <Check className="size-6 shrink-0" aria-hidden />}
                {c.agency_name}
              </button>
            ))}
            <button
              onClick={() => setContractorId("unknown")}
              aria-pressed={contractorId === "unknown"}
              className={`flex min-h-16 w-full items-center gap-3 rounded-2xl border px-4 text-left text-xl font-bold ${
                contractorId === "unknown" ? "border-brand bg-brand/5 text-brand ring-2 ring-brand" : "border-dashed border-ink-soft bg-white"
              }`}
            >
              {t("पता नहीं", "Don't know")}
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-4">
          <h1 className="text-3xl font-bold leading-tight">{t("आप किस भाषा में सुनना चाहेंगे?", "Which language would you like?")}</h1>
          <div className="rounded-xl bg-iitr p-4">
            <DialectBar value={dialect} onChange={setDialect} />
          </div>
          <p className="text-lg text-ink-soft">{t("आप इसे बाद में ऊपर के अ/A बटन से कभी भी बदल सकते हैं।", "You can change this any time with the अ/A button at the top.")}</p>
        </section>
      )}

      {error && (
        <p role="alert" className="rounded-2xl bg-danger/10 p-4 text-xl font-bold text-danger">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        {step > 0 && (
          <button
            onClick={() => setStep((s) => (s - 1) as Step)}
            aria-label={t("पीछे", "Back")}
            className="grid h-16 w-20 place-items-center rounded-2xl border border-line shadow-sm bg-white"
          >
            <ArrowLeft className="size-8" aria-hidden />
          </button>
        )}
        <button
          disabled={!canNext || busy}
          onClick={() => (step === 3 ? void save() : setStep((s) => (s + 1) as Step))}
          className="flex h-16 flex-1 items-center justify-center gap-3 rounded-2xl bg-ok text-2xl font-bold text-white disabled:opacity-50"
        >
          {busy && step === 3 ? <Loader2 className="size-7 animate-spin" aria-hidden /> : step === 3 ? <Check className="size-8" aria-hidden /> : <ArrowRight className="size-8" aria-hidden />}
          {step === 3 ? t("शुरू करें", "Start") : t("आगे", "Next")}
        </button>
      </div>
    </div>
  );
}
