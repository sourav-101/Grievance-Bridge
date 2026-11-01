"use client";
import { ArrowRight, Bot, Loader2, Mic, Send, Square, Volume2, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useRecorder } from "@/hooks/useRecorder";
import { ApiError, audioForm, postForm, sendJson } from "@/lib/client/api";
import type { AssistantAction } from "@/lib/ai/assistant-rules";
import type { SpeechPayload } from "@/lib/types";
import { useLanguage } from "./LanguageProvider";
import { useSpeech } from "./SpeechProvider";

interface Msg {
  id: string;
  role: "user" | "assistant";
  text: string;
  actions?: AssistantAction[];
  speech?: SpeechPayload | null;
}

const QUICK_HI = ["शिकायत कैसे करें?", "मेरी शिकायत की स्थिति", "PIN भूल गया", "योजनाओं की जानकारी", "आपातकाल नंबर"];
const QUICK_EN = ["How do I complain?", "Status of my complaint", "I forgot my PIN", "Information on schemes", "Emergency numbers"];
const WELCOME_HI = "नमस्ते! मैं आपका सहायक हूँ। वेबसाइट में कुछ भी ढूंढने में परेशानी हो तो यहाँ लिखें या माइक दबाकर बोलें।";
const WELCOME_EN = "Hello! I am your assistant. If you have trouble finding anything on this website, type here or press the mic and speak.";

/**
 * Floating help chatbot (bottom-right on every page). Answers "how do I…"
 * questions with short Hindi replies plus buttons that take the worker to the right page.
 */
export function ChatAssistant({
  onEmergency,
  raised = false,
  speakReplies = false,
}: {
  /** Opens the emergency helplines; when absent a 112 call button is shown instead. */
  onEmergency?: () => void;
  /** Lift the button above a bottom navigation bar. */
  raised?: boolean;
  /** Read each reply aloud automatically (logged-in workers; spoken replies need a session). */
  speakReplies?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // Conversation so far; the welcome bubble is drawn separately so it follows the language.
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const recorder = useRecorder(20);
  const { play, speakText, activeId, stop } = useSpeech();
  const { dialect, t } = useLanguage();
  const shown: Msg[] = [{ id: "welcome", role: "assistant", text: t(WELCOME_HI, WELCOME_EN) }, ...msgs];
  const netError = t("नेटवर्क की समस्या। फिर से कोशिश करें।", "Network problem. Please try again.");

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, open]);

  // Any page can open the assistant: window.dispatchEvent(new Event("open-assistant"))
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("open-assistant", show);
    return () => window.removeEventListener("open-assistant", show);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const history = () => msgs.slice(-8).map((m) => ({ role: m.role, text: m.text }));

  function receive(r: { reply: string; actions: AssistantAction[]; speech?: SpeechPayload | null }) {
    const m: Msg = { id: `${Date.now()}a`, role: "assistant", text: r.reply, actions: r.actions, speech: r.speech };
    setMsgs((prev) => [...prev, m]);
    if (r.speech) void play(r.speech, m.id);
    else if (speakReplies) void speakText(r.reply, { id: m.id, dialect, adapt: false });
  }

  async function ask(message: string) {
    const q = message.trim();
    if (!q || busy) return;
    setText("");
    setMsgs((prev) => [...prev, { id: `${Date.now()}u`, role: "user", text: q }]);
    setBusy(true);
    try {
      receive(await sendJson("/api/assistant", { message: q, history: history(), dialect, path: pathname }));
    } catch (e) {
      receive({ reply: e instanceof ApiError ? e.message : netError, actions: [] });
    } finally {
      setBusy(false);
    }
  }

  async function speak() {
    if (recorder.isRecording) return recorder.stop();
    stop();
    const blob = await recorder.start();
    if (!blob) return;
    setBusy(true);
    try {
      const r = await postForm<{ transcript: string; reply: string; actions: AssistantAction[]; speech?: SpeechPayload | null }>(
        "/api/assistant",
        audioForm(blob, { history: JSON.stringify(history()), dialect, path: pathname }),
      );
      if (r.transcript) setMsgs((prev) => [...prev, { id: `${Date.now()}u`, role: "user", text: r.transcript }]);
      receive(r);
    } catch (e) {
      receive({ reply: e instanceof ApiError ? e.message : netError, actions: [] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label={t("सहायक चैट खोलें — वेबसाइट में मदद", "Open help chat")}
          className={`fixed right-4 z-50 flex size-14 flex-col items-center justify-center rounded-full bg-indigo-deep text-white shadow-[0_8px_24px_rgba(11,44,63,0.45)] ring-4 ring-white transition active:scale-95 ${
            raised ? "bottom-24" : "bottom-5"
          }`}
        >
          <Bot className="size-6" strokeWidth={1.8} aria-hidden />
          <span className="text-[10px] font-semibold leading-none">{t("मदद", "Help")}</span>
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[65] flex items-end justify-end bg-black/40 sm:bg-transparent" onClick={() => setOpen(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label={t("सहायक चैट", "Help chat")}
            onClick={(e) => e.stopPropagation()}
            className="flex h-[88dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:m-4 sm:h-[600px] sm:w-[400px] sm:rounded-2xl"
          >
            <header className="flex items-center gap-3 bg-indigo-deep px-4 py-3 text-white">
              <span className="grid size-10 place-items-center rounded-full bg-white text-indigo-deep">
                <Bot className="size-6" strokeWidth={1.8} aria-hidden />
              </span>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="text-lg font-semibold">{t("सहायक", "Assistant")}</p>
                <p className="text-sm text-white/80">{t("वेबसाइट इस्तेमाल करने में मदद", "Help using this website")}</p>
              </div>
              <button onClick={() => setOpen(false)} aria-label={t("चैट बंद करें", "Close chat")} className="grid size-10 place-items-center rounded-full hover:bg-white/10">
                <X className="size-6" aria-hidden />
              </button>
            </header>

            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-paper px-3 py-4" aria-live="polite">
              {shown.map((m) =>
                m.role === "user" ? (
                  <p key={m.id} className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-brand px-4 py-2.5 text-base text-white">
                    {m.text}
                  </p>
                ) : (
                  <div key={m.id} className="max-w-[92%] space-y-2 rounded-2xl rounded-bl-sm border border-line bg-white px-4 py-3 shadow-sm">
                    <p className="text-base leading-relaxed text-ink">{m.text}</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() =>
                          activeId === m.id ? stop() : m.speech ? void play(m.speech, m.id) : void speakText(m.text, { id: m.id, dialect, adapt: false })
                        }
                        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-3 text-sm font-medium text-ink-soft"
                      >
                        {activeId === m.id ? <Square className="size-4 fill-current" aria-hidden /> : <Volume2 className="size-4" aria-hidden />}
                        {activeId === m.id ? t("रोकें", "Stop") : t("सुनें", "Listen")}
                      </button>
                      {m.actions?.map((a) =>
                        a.href === "#emergency" ? (
                          onEmergency ? (
                            <button
                              key={a.href}
                              onClick={() => {
                                setOpen(false);
                                onEmergency();
                              }}
                              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-danger px-3 text-sm font-semibold text-white"
                            >
                              {a.label} <ArrowRight className="size-4" aria-hidden />
                            </button>
                          ) : (
                            <a key={a.href} href="tel:112" className="inline-flex h-9 items-center rounded-full bg-danger px-3 text-sm font-semibold text-white">
                              {t("112 पर फ़ोन करें", "Call 112")}
                            </a>
                          )
                        ) : (
                          <Link
                            key={a.href}
                            href={a.href}
                            onClick={() => setOpen(false)}
                            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-brand px-3 text-sm font-semibold text-brand"
                          >
                            {a.label} <ArrowRight className="size-4" aria-hidden />
                          </Link>
                        ),
                      )}
                    </div>
                  </div>
                ),
              )}
              {busy && (
                <p className="flex items-center gap-2 text-sm text-ink-soft">
                  <Loader2 className="size-4 animate-spin" aria-hidden /> {t("सोच रहा हूँ…", "Thinking…")}
                </p>
              )}
              {msgs.length === 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {QUICK_HI.map((hi, i) => t(hi, QUICK_EN[i])).map((q) => (
                    <button key={q} onClick={() => void ask(q)} className="rounded-full border border-indigo-soft bg-white px-3 py-2 text-sm font-medium text-indigo">
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {recorder.error && <p className="bg-white px-4 pt-2 text-sm text-danger">{recorder.error}</p>}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void ask(text);
              }}
              className="flex items-center gap-2 border-t border-line bg-white p-3 pb-[max(env(safe-area-inset-bottom),12px)]"
            >
              <button
                type="button"
                onClick={speak}
                disabled={busy && !recorder.isRecording}
                aria-label={recorder.isRecording ? t("रिकॉर्डिंग रोकें", "Stop recording") : t("बोलकर पूछें", "Ask by voice")}
                className={`grid size-12 shrink-0 place-items-center rounded-full text-white ${recorder.isRecording ? "animate-pulse bg-danger" : "bg-brand"}`}
              >
                {recorder.isRecording ? <Square className="size-5 fill-current" aria-hidden /> : <Mic className="size-6" aria-hidden />}
              </button>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={recorder.isRecording ? t("बोलिए… फिर रोकें दबाएं", "Speak… then press stop") : t("अपना सवाल लिखें…", "Type your question…")}
                aria-label={t("अपना सवाल लिखें", "Type your question")}
                className="h-12 min-w-0 flex-1 rounded-full border border-line bg-paper px-4 text-base outline-none focus:border-indigo"
              />
              <button type="submit" disabled={!text.trim() || busy} aria-label={t("भेजें", "Send")} className="grid size-12 shrink-0 place-items-center rounded-full bg-indigo-deep text-white disabled:opacity-40">
                <Send className="size-5" aria-hidden />
              </button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
