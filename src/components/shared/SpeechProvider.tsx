"use client";
import { Volume2 } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { sendJson } from "@/lib/client/api";
import { hasDevanagari } from "@/lib/i18n";
import type { Dialect, SpeechPayload } from "@/lib/types";
import type { PublicPromptKey } from "@/lib/i18n/prompts";
import { useLanguage } from "./LanguageProvider";

interface SpeechCtx {
  /** id of the item currently speaking (or loading), for button states. */
  activeId: string | null;
  loadingId: string | null;
  /** Autoplay was blocked by the browser; show a "tap to listen" hint. */
  blocked: SpeechPayload | null;
  play: (payload: SpeechPayload, id?: string) => Promise<void>;
  speakText: (text: string, opts?: { id?: string; dialect?: Dialect; adapt?: boolean }) => Promise<void>;
  speakPrompt: (key: PublicPromptKey, opts?: { id?: string; dialect?: Dialect }) => Promise<void>;
  stop: () => void;
  retryBlocked: () => void;
}

const Ctx = createContext<SpeechCtx | null>(null);

export function useSpeech(): SpeechCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSpeech must be used inside <SpeechProvider>");
  return c;
}

/**
 * Single audio channel for the whole app: plays Sarvam MP3 chunks in order,
 * falls back to the browser's Hindi speechSynthesis when the server returns no
 * audio, caches fetched speech per text+dialect, and handles autoplay blocking.
 */
export function SpeechProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const runRef = useRef(0);
  const cache = useRef(new Map<string, SpeechPayload>());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<SpeechPayload | null>(null);
  // Default dialect for speakText/speakPrompt: the site-wide language choice.
  const { dialect: currentDialect } = useLanguage();
  const dialectRef = useRef<Dialect>(currentDialect);
  dialectRef.current = currentDialect;

  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.preload = "auto";
    return () => {
      audioRef.current?.pause();
      if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    };
  }, []);

  const stop = useCallback(() => {
    runRef.current++;
    audioRef.current?.pause();
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    setActiveId(null);
  }, []);

  const browserSpeak = useCallback((text: string, run: number) => {
    return new Promise<void>((resolve) => {
      if (typeof speechSynthesis === "undefined") return resolve();
      const u = new SpeechSynthesisUtterance(text);
      // Pick the device voice from the text itself (English answers have no Devanagari).
      const english = !hasDevanagari(text);
      u.lang = english ? "en-IN" : "hi-IN";
      u.rate = 0.9;
      const prefix = english ? "en" : "hi";
      const voices = speechSynthesis.getVoices();
      const voice = voices.find((v) => v.lang?.toLowerCase() === u.lang.toLowerCase()) ?? voices.find((v) => v.lang?.toLowerCase().startsWith(prefix));
      if (voice) u.voice = voice;
      u.onend = u.onerror = () => resolve();
      if (run === runRef.current) speechSynthesis.speak(u);
      else resolve();
    });
  }, []);

  /** Voice for a text-only (deferred) payload, from /api/tts; cached per text. */
  const fetchVoice = useCallback(async (text: string): Promise<SpeechPayload | null> => {
    const key = `v:${text}`;
    const hit = cache.current.get(key);
    if (hit) return hit;
    try {
      const fetched = await sendJson<SpeechPayload>("/api/tts", { text, adapt: false });
      if (!fetched.audios?.length) return null;
      cache.current.set(key, fetched);
      return fetched;
    } catch {
      return null;
    }
  }, []);

  const play = useCallback(
    async (input: SpeechPayload, id = "default") => {
      stop();
      const run = ++runRef.current;
      setActiveId(id);
      setBlocked(null);
      let payload = input;
      try {
        if (!payload.audios?.length && payload.deferred) {
          setLoadingId(id);
          const voiced = await fetchVoice(payload.text);
          setLoadingId((cur) => (cur === id ? null : cur));
          if (run !== runRef.current) return;
          if (voiced) payload = voiced;
        }
        if (!payload.audios?.length) {
          await browserSpeak(payload.text, run);
          return;
        }
        const audio = audioRef.current!;
        for (const chunk of payload.audios) {
          if (run !== runRef.current) return;
          audio.src = `data:${payload.mime};base64,${chunk}`;
          await new Promise<void>((resolve, reject) => {
            audio.onended = () => resolve();
            audio.onerror = () => reject(new Error("audio error"));
            audio.play().catch(reject);
          });
        }
      } catch (e) {
        if ((e as { name?: string })?.name === "NotAllowedError") setBlocked(payload);
        else if (run === runRef.current) await browserSpeak(payload.text, run);
      } finally {
        if (run === runRef.current) setActiveId(null);
      }
    },
    [browserSpeak, fetchVoice, stop],
  );

  const fetchAndPlay = useCallback(
    async (cacheKey: string, body: Record<string, unknown>, id: string) => {
      const hit = cache.current.get(cacheKey);
      if (hit) return play(hit, id);
      setLoadingId(id);
      try {
        const payload = await sendJson<SpeechPayload>("/api/tts", body);
        cache.current.set(cacheKey, payload);
        if (cache.current.size > 60) cache.current.delete(cache.current.keys().next().value as string);
        setLoadingId(null);
        await play(payload, id);
      } catch {
        setLoadingId(null);
        // Network/TTS failure: still read it with the device voice if we have the text.
        if (typeof body.text === "string") {
          await play({ text: body.text, audios: null, mime: "" }, id);
        }
      }
    },
    [play],
  );

  const speakText = useCallback(
    (text: string, opts: { id?: string; dialect?: Dialect; adapt?: boolean } = {}) => {
      const dialect = opts.dialect ?? dialectRef.current;
      return fetchAndPlay(`t:${dialect ?? ""}:${text}`, { text, dialect, adapt: opts.adapt }, opts.id ?? text.slice(0, 40));
    },
    [fetchAndPlay],
  );

  const speakPrompt = useCallback(
    (key: PublicPromptKey, opts: { id?: string; dialect?: Dialect } = {}) => {
      const dialect = opts.dialect ?? dialectRef.current;
      return fetchAndPlay(`p:${dialect ?? ""}:${key}`, { promptKey: key, dialect }, opts.id ?? key);
    },
    [fetchAndPlay],
  );

  const retryBlocked = useCallback(() => {
    if (blocked) void play(blocked);
  }, [blocked, play]);

  const value = useMemo(
    () => ({ activeId, loadingId, blocked, play, speakText, speakPrompt, stop, retryBlocked }),
    [activeId, loadingId, blocked, play, speakText, speakPrompt, stop, retryBlocked],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {blocked && (
        <button
          onClick={retryBlocked}
          className="fixed inset-x-4 top-4 z-[70] mx-auto flex max-w-md items-center justify-center gap-3 rounded-xl bg-indigo-deep px-5 py-4 text-lg font-bold text-white shadow-xl"
        >
          <Volume2 className="size-7" aria-hidden /> {currentDialect === "english" ? "Tap here to listen" : "सुनने के लिए यहाँ दबाएं"}
        </button>
      )}
    </Ctx.Provider>
  );
}
