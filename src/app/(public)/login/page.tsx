"use client";
import { ArrowLeft, ArrowRight, Loader2, Volume2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/shared/LanguageProvider";
import { PinPad } from "@/components/shared/PinPad";
import { useSpeech } from "@/components/shared/SpeechProvider";
import { ApiError, sendJson } from "@/lib/client/api";
import { isWeakPin } from "@/lib/auth/pin-rules";
import type { PublicPromptKey } from "@/lib/i18n/prompts";

type Step =
  | "phone"
  | "otp" // AUTH_MODE=otp
  | "pin-enter" // existing PIN
  | "pin-create"
  | "pin-confirm"
  | "reset-code" // Estate Office one-time code
  | "reset-new"
  | "reset-confirm";

const STEP_PROMPT: Record<Step, PublicPromptKey> = {
  phone: "welcome",
  otp: "enter_otp",
  "pin-enter": "pin_enter",
  "pin-create": "pin_create",
  "pin-confirm": "pin_confirm",
  "reset-code": "pin_reset",
  "reset-new": "pin_create",
  "reset-confirm": "pin_confirm",
};

const STEP_TITLE: Record<Step, string> = {
  phone: "अपना मोबाइल नंबर डालें",
  otp: "OTP डालें",
  "pin-enter": "अपना PIN दबाएं",
  "pin-create": "नया PIN बनाएं",
  "pin-confirm": "PIN फिर से दबाएं",
  "reset-code": "एस्टेट ऑफिस का कोड",
  "reset-new": "नया PIN बनाएं",
  "reset-confirm": "PIN फिर से दबाएं",
};

const STEP_TITLE_EN: Record<Step, string> = {
  phone: "Enter your mobile number",
  otp: "Enter the OTP",
  "pin-enter": "Enter your PIN",
  "pin-create": "Create a new PIN",
  "pin-confirm": "Enter the PIN again",
  "reset-code": "Estate Office code",
  "reset-new": "Create a new PIN",
  "reset-confirm": "Enter the PIN again",
};

function ListenButton({ prompt }: { prompt: PublicPromptKey }) {
  const { speakPrompt, activeId, loadingId, stop } = useSpeech();
  const { t } = useLanguage();
  const busy = loadingId === prompt;
  const playing = activeId === prompt;
  return (
    <button
      type="button"
      onClick={() => (playing ? stop() : void speakPrompt(prompt))}
      className="flex h-14 shrink-0 items-center gap-2 rounded-2xl bg-brand px-5 text-xl font-bold text-white"
    >
      {busy ? <Loader2 className="size-6 animate-spin" aria-hidden /> : <Volume2 className="size-6" aria-hidden />}
      {playing ? t("रोकें", "Stop") : t("सुनें", "Listen")}
    </button>
  );
}

function LoginForm() {
  const next = useSearchParams().get("next") || "/";
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [entry, setEntry] = useState(""); // digits currently being typed on the keypad / OTP box
  const [firstPin, setFirstPin] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const otpRef = useRef<HTMLInputElement>(null);
  const { speakPrompt } = useSpeech();
  const { lang, t } = useLanguage();
  const netError = t("नेटवर्क की समस्या। फिर से कोशिश करें।", "Network problem. Please try again.");
  const weakPin = t("यह PIN बहुत आसान है (जैसे 1111 या 1234)। कोई और 4 अंक चुनें।", "This PIN is too easy (like 1111 or 1234). Choose 4 other digits.");

  const go = useCallback(
    (s: Step, speak = true) => {
      setStep(s);
      setEntry("");
      if (speak) void speakPrompt(STEP_PROMPT[s]);
    },
    [speakPrompt],
  );

  const finish = useCallback(
    (isNewWorker: boolean) => {
      // Full navigation so middleware sees the new session cookie.
      // Only same-site paths: "//evil.com" or "/\evil.com" would be an open redirect.
      const safeNext = /^\/(?![/\\])/.test(next) ? next : "/";
      location.href = isNewWorker ? "/onboarding" : safeNext;
    },
    [next],
  );

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // ------------------------------------------------------------------ step 1
  async function start() {
    setError(null);
    setLoading(true);
    try {
      const r = await sendJson<{ mode: "otp" | "pin"; status?: "new" | "existing" | "reset"; lockedForSeconds?: number }>(
        "/api/auth/start",
        { phone },
      );
      if (r.mode === "otp") {
        await sendOtp();
        return;
      }
      if (r.lockedForSeconds) {
        const mins = Math.ceil(r.lockedForSeconds / 60);
        setError(t(`बहुत बार गलत PIN डाला गया। ${mins} मिनट बाद कोशिश करें।`, `Too many wrong PINs. Try again after ${mins} minutes.`));
      }
      go(r.status === "existing" ? "pin-enter" : r.status === "reset" ? "reset-code" : "pin-create");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : netError);
    } finally {
      setLoading(false);
    }
  }

  // ------------------------------------------------------------------ PIN
  async function submitPin(body: Record<string, string>) {
    setLoading(true);
    setError(null);
    try {
      const r = await sendJson<{ isNewWorker: boolean }>("/api/auth/pin", { phone, ...body });
      finish(r.isNewWorker);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : netError;
      setError(msg);
      const status = e instanceof ApiError ? e.status : 0;
      if (e instanceof ApiError && e.data.status === "reset") go("reset-code", false);
      else if (body.action === "create") go(status === 409 ? "pin-enter" : "pin-create", false);
      else if (body.action === "reset") go([401, 409, 410, 429].includes(status) ? "reset-code" : "reset-new", false);
      else setEntry("");
      setLoading(false);
    }
  }

  function onKeypadComplete(v: string) {
    setError(null);
    switch (step) {
      case "pin-enter":
        return void submitPin({ action: "login", pin: v });
      case "pin-create":
      case "reset-new":
        if (isWeakPin(v)) {
          setError(weakPin);
          setEntry("");
          return;
        }
        setFirstPin(v);
        return go(step === "pin-create" ? "pin-confirm" : "reset-confirm");
      case "pin-confirm":
      case "reset-confirm":
        if (v !== firstPin) {
          setError(t("दोनों PIN अलग हैं। फिर से नया PIN बनाएं।", "The two PINs are different. Create a new PIN again."));
          return go(step === "pin-confirm" ? "pin-create" : "reset-new", false);
        }
        return void submitPin(step === "pin-confirm" ? { action: "create", pin: v } : { action: "reset", pin: v, resetCode });
      case "reset-code":
        setResetCode(v);
        return go("reset-new");
    }
  }

  // ------------------------------------------------------------------ OTP (AUTH_MODE=otp)
  async function sendOtp() {
    setError(null);
    setLoading(true);
    try {
      const r = await sendJson<{ ok: boolean; devCode?: string }>("/api/auth/send-otp", { phone });
      setDevCode(r.devCode ?? null);
      go("otp");
      setResendIn(30);
      setTimeout(() => otpRef.current?.focus(), 50);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("OTP नहीं भेजा जा सका।", "Could not send the OTP."));
    } finally {
      setLoading(false);
    }
  }

  const verifyOtp = useCallback(
    async (c: string) => {
      if (!/^\d{4}$/.test(c)) return;
      setError(null);
      setLoading(true);
      try {
        const r = await sendJson<{ isNewWorker: boolean }>("/api/auth/verify-otp", { phone, code: c });
        finish(r.isNewWorker);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : t("OTP जांच नहीं हो सकी।", "Could not check the OTP."));
        setEntry("");
        setLoading(false);
      }
    },
    [finish, phone, t],
  );

  // WebOTP: Chrome on Android reads "@domain #1234" from the SMS and fills it in.
  useEffect(() => {
    if (step !== "otp" || typeof window === "undefined" || !("OTPCredential" in window)) return;
    const ac = new AbortController();
    navigator.credentials
      .get({ otp: { transport: ["sms"] }, signal: ac.signal } as CredentialRequestOptions)
      .then((cred) => {
        const otp = (cred as unknown as { code?: string } | null)?.code;
        if (otp) {
          setEntry(otp);
          void verifyOtp(otp);
        }
      })
      .catch(() => undefined);
    return () => ac.abort();
  }, [step, verifyOtp]);

  const keypadStep = step !== "phone" && step !== "otp";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-3xl font-bold leading-tight">{t(STEP_TITLE[step], STEP_TITLE_EN[step])}</h1>
        <ListenButton prompt={STEP_PROMPT[step]} />
      </div>

      {step === "phone" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void start();
          }}
          className="space-y-4"
        >
          <div className="flex h-20 items-center overflow-hidden rounded-2xl border border-line shadow-sm bg-white">
            <span className="grid h-full place-items-center bg-paper-deep px-4 text-2xl font-bold">+91</span>
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={10}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="98765 43210"
              aria-label={t("10 अंकों का मोबाइल नंबर", "10 digit mobile number")}
              className="h-full min-w-0 flex-1 px-3 text-2xl font-semibold tracking-wide outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={phone.length !== 10 || loading}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-brand py-5 text-2xl font-bold text-white disabled:opacity-50"
          >
            {loading ? <Loader2 className="size-7 animate-spin" aria-hidden /> : <ArrowRight className="size-8" aria-hidden />}
            {t("आगे बढ़ें", "Continue")}
          </button>
        </form>
      )}

      {step !== "phone" && (
        <p className="flex flex-wrap items-center gap-x-3 text-xl">
          <span>+91 {phone}</span>
          <button
            className="inline-flex items-center gap-1 font-bold underline"
            onClick={() => {
              setStep("phone");
              setEntry("");
              setError(null);
            }}
          >
            <ArrowLeft className="size-5" aria-hidden /> {t("नंबर बदलें", "Change number")}
          </button>
        </p>
      )}

      {step === "pin-create" && (
        <p className="rounded-2xl bg-paper p-3 text-lg">{t("यह PIN याद रखें और किसी को न बताएं। हर बार लॉग इन करने के लिए यही PIN लगेगा।", "Remember this PIN and do not tell anyone. You will need it every time you log in.")}</p>
      )}
      {step === "reset-code" && (
        <p className="rounded-2xl bg-paper p-3 text-lg">{t("आपका PIN एस्टेट ऑफिस ने रीसेट किया है। वहाँ से मिला 6 अंकों का कोड दबाएं, फिर नया PIN बनाएं।", "The Estate Office has reset your PIN. Enter the 6 digit code they gave you, then create a new PIN.")}</p>
      )}

      {keypadStep && error && (
        <p role="alert" className="rounded-2xl bg-danger/10 p-4 text-xl font-bold text-danger">
          {error}
        </p>
      )}

      {keypadStep && (
        <PinPad
          key={step}
          value={entry}
          onChange={setEntry}
          length={step === "reset-code" ? 6 : 4}
          onComplete={onKeypadComplete}
          disabled={loading}
        />
      )}

      {step === "pin-enter" && (
        <div className="space-y-2 text-center">
          <ListenForgot />
        </div>
      )}

      {step === "otp" && (
        <>
          {devCode && (
            <p className="rounded-2xl border-2 border-dashed border-saffron-deep bg-saffron/20 p-3 text-lg">
              <strong>{t("टेस्ट मोड:", "Test mode:")}</strong> {t("SMS नहीं भेजा गया। आपका OTP है", "No SMS was sent. Your OTP is")} <strong className="tracking-widest">{devCode}</strong>
            </p>
          )}
          <input
            ref={otpRef}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={4}
            value={entry}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 4);
              setEntry(v);
              if (v.length === 4) void verifyOtp(v);
            }}
            aria-label={t("4 अंकों का OTP", "4 digit OTP")}
            className="h-24 w-full rounded-2xl border border-line shadow-sm bg-white text-center text-6xl font-bold tracking-[0.5em]"
          />
          <button
            disabled={resendIn > 0 || loading}
            onClick={sendOtp}
            className="w-full rounded-2xl border border-line shadow-sm py-4 text-xl font-bold disabled:opacity-50"
          >
            {resendIn > 0 ? t(`${resendIn} सेकंड बाद फिर से भेजें`, `Resend in ${resendIn} seconds`) : t("OTP फिर से भेजें", "Resend OTP")}
          </button>
        </>
      )}

      {loading && step !== "phone" && (
        <p className="flex items-center justify-center gap-2 text-xl">
          <Loader2 className="size-6 animate-spin" aria-hidden /> {t("जांच हो रही है…", "Checking…")}
        </p>
      )}
      {!keypadStep && error && (
        <p role="alert" className="rounded-2xl bg-danger/10 p-4 text-xl font-bold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function ListenForgot() {
  const { speakPrompt } = useSpeech();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  return open ? (
    <p className="rounded-2xl bg-paper p-3 text-lg">
      {t("अपना आधार या पहचान पत्र लेकर एस्टेट ऑफिस जाएं। वहाँ आपको 6 अंकों का कोड मिलेगा, जिससे आप नया PIN बना सकेंगे।", "Take your Aadhaar or ID card to the Estate Office. They will give you a 6 digit code to create a new PIN.")}
    </p>
  ) : (
    <button
      onClick={() => {
        setOpen(true);
        void speakPrompt("pin_forgot");
      }}
      className="text-xl font-bold underline"
    >
      {t("PIN भूल गए?", "Forgot PIN?")}
    </button>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
