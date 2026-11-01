import "server-only";
import { createHash } from "node:crypto";
import { DIALECTS } from "../constants";
import { isConfigured } from "../env";
import { hasDevanagari } from "../i18n";
import type { Dialect, SpeechPayload } from "../types";
import { groqText } from "./groq";
import { textToSpeech } from "./sarvam";

/**
 * Dialect output strategy: Sarvam has no Bhojpuri/Garhwali/Kumaoni voices, so
 * the LLM rewrites the Hindi text into the chosen dialect (Devanagari) and the
 * Hindi voice reads it aloud.
 */
export async function adaptToDialect(text: string, dialect: Dialect): Promise<string> {
  if (dialect === "hindi" || !text.trim() || !isConfigured("GROQ_API_KEY")) return text;
  // English: fixed prompts are already written in English; only translate Hindi text.
  if (dialect === "english" && !hasDevanagari(text)) return text;
  const cacheKey = `dialect:${dialect}:${hash(text)}`;
  const hit = textCache.get(cacheKey);
  if (hit) return hit;
  try {
    const system =
      dialect === "english"
        ? `You translate short Hindi messages for low-literacy contract workers into simple, plain Indian English. ` +
          `Keep the meaning, every number, token, phone number and place name EXACTLY the same (write place names in English letters). ` +
          `Use short, easy sentences. Return ONLY the translated text, nothing else.`
        : `You rewrite short Hindi messages for low-literacy contract workers into ${DIALECTS[dialect].promptName}, ` +
          `written in Devanagari script. Keep the meaning, every number, token, phone number and place name EXACTLY the same. ` +
          `Use simple everyday spoken words of that dialect. If unsure of a dialect word, use simple Hindi. ` +
          `Return ONLY the rewritten text, nothing else.`;
    const out = await groqText(system, text, { temperature: 0.3, maxTokens: 800, effort: "low" });
    const result = out || text;
    remember(textCache, cacheKey, result);
    return result;
  } catch (e) {
    console.warn("adaptToDialect failed, using Hindi", e);
    return text;
  }
}

/**
 * Spoken text in the worker's language, WITHOUT audio: routes return this so their
 * response is not held up by speech synthesis (~3 s); the browser then fetches the
 * voice for exactly this text from /api/tts (adapt: false).
 */
export async function speechText(text: string, dialect: Dialect): Promise<SpeechPayload> {
  return { text: await adaptToDialect(text, dialect), audios: null, mime: "audio/mpeg", deferred: true };
}

/** Synthesize speech for text in the worker's dialect. Falls back to browser TTS (audios=null). */
export async function synthesize(text: string, dialect: Dialect, opts: { adapt?: boolean } = {}): Promise<SpeechPayload> {
  const spoken = opts.adapt === false ? text : await adaptToDialect(text, dialect);
  // Voice follows the text: English text (no Devanagari) is read with the English voice.
  const languageCode = hasDevanagari(spoken) ? "hi-IN" : "en-IN";
  const key = `tts:${languageCode}:${hash(spoken)}`;
  const cached = audioCache.get(key);
  if (cached) return { text: spoken, audios: cached.audios, mime: cached.mime };
  try {
    const tts = await textToSpeech(spoken, languageCode);
    if (!tts || !tts.audios.length) return { text: spoken, audios: null, mime: "audio/mpeg" };
    remember(audioCache, key, tts);
    return { text: spoken, audios: tts.audios, mime: tts.mime };
  } catch (e) {
    // Never block the flow on TTS — the client will read the text with speechSynthesis.
    console.warn("TTS failed, client will fall back to browser speech", e);
    return { text: spoken, audios: null, mime: "audio/mpeg" };
  }
}

// ---------------------------------------------------------------- tiny LRU caches (per server instance)
const textCache = new Map<string, string>();
const audioCache = new Map<string, { audios: string[]; mime: string }>();
const MAX_ENTRIES = 300;

function remember<V>(map: Map<string, V>, key: string, value: V) {
  map.delete(key);
  map.set(key, value);
  if (map.size > MAX_ENTRIES) {
    const oldest = map.keys().next().value;
    if (oldest !== undefined) map.delete(oldest);
  }
}

function hash(s: string) {
  return createHash("sha1").update(s).digest("hex");
}
