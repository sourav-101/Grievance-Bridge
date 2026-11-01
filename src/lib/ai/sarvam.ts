import "server-only";
import { env, envNumber, isConfigured } from "../env";
import { UpstreamError, fetchWithTimeout } from "../http";
import { chunkForTts } from "../text";

const BASE = "https://api.sarvam.ai";
const TTS_MAX_CHARS = 2400; // Bulbul v3 REST limit is 2500 per request

export interface SttResult {
  transcript: string;
  languageCode: string | null;
}

/**
 * Speech-to-text (Sarvam Saaras). Hindi and the three dialects are transcribed as
 * hi-IN (regional words come through in Devanagari and are normalised later by
 * the LLM); English speakers use en-IN.
 */
export async function speechToText(audio: Blob, opts: { keyterms?: string[]; languageCode?: "hi-IN" | "en-IN" } = {}): Promise<SttResult> {
  const apiKey = env("SARVAM_API_KEY");
  const model = process.env.SARVAM_STT_MODEL || "saaras:v4";

  const form = new FormData();
  const filename = audio.type.includes("wav")
    ? "audio.wav"
    : audio.type.includes("webm")
      ? "audio.webm"
      : audio.type.includes("ogg")
        ? "audio.ogg"
        : "audio.m4a";
  form.append("file", audio, filename);
  form.append("model", model);
  form.append("language_code", opts.languageCode ?? "hi-IN");
  if (model.startsWith("saaras:v3")) form.append("mode", "transcribe");
  if (model.startsWith("saaras:v4") && opts.keyterms?.length) {
    form.append("keyterms", JSON.stringify(opts.keyterms.slice(0, 50)));
  }

  const res = await fetchWithTimeout(
    `${BASE}/speech-to-text`,
    { method: "POST", headers: { "api-subscription-key": apiKey }, body: form },
    30000,
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new UpstreamError("Speech-to-text", `Sarvam STT ${res.status}: ${detail.slice(0, 300)}`, res.status);
  }
  const data = (await res.json()) as { transcript?: string; language_code?: string | null };
  return { transcript: (data.transcript || "").trim(), languageCode: data.language_code ?? null };
}

export interface TtsResult {
  audios: string[];
  mime: string;
}

/** Text-to-speech (Sarvam Bulbul). Returns null if Sarvam is not configured. */
export async function textToSpeech(text: string, languageCode: "hi-IN" | "en-IN" = "hi-IN"): Promise<TtsResult | null> {
  if (!isConfigured("SARVAM_API_KEY")) return null;
  const apiKey = env("SARVAM_API_KEY");
  const model = process.env.SARVAM_TTS_MODEL || "bulbul:v3";
  const speaker = process.env.SARVAM_TTS_SPEAKER || undefined;
  const pace = envNumber("SARVAM_TTS_PACE", 0.9);

  const audios: string[] = [];
  for (const chunk of chunkForTts(text, TTS_MAX_CHARS)) {
    const res = await fetchWithTimeout(
      `${BASE}/text-to-speech`,
      {
        method: "POST",
        headers: { "api-subscription-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          text: chunk,
          language_code: languageCode,
          model,
          ...(speaker ? { speaker } : {}),
          pace,
          output_audio_codec: "mp3",
        }),
      },
      30000,
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new UpstreamError("Text-to-speech", `Sarvam TTS ${res.status}: ${detail.slice(0, 300)}`, res.status);
    }
    const data = (await res.json()) as { audios?: string[] };
    if (data.audios?.[0]) audios.push(...data.audios);
  }
  return { audios, mime: "audio/mpeg" };
}
