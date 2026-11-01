"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/shared/LanguageProvider";
import { encodeWav, mixToMono, normalizePeak, resampleLinear } from "@/lib/client/wav";

export type RecorderState = "idle" | "requesting" | "recording" | "processing" | "error";

const TARGET_RATE = 16000;

/**
 * Microphone recorder with in-browser noise suppression:
 *   1. getUserMedia with the browser's built-in noiseSuppression / echoCancellation / autoGainControl
 *   2. Web Audio filter chain: high-pass 120 Hz (wind, traffic, machinery rumble)
 *      → low-pass 7 kHz (hiss, grinder whine above the speech band)
 *      → gentle compressor (evens out shouting vs. distance from phone)
 *   3. MediaRecorder captures the filtered stream; on stop it is decoded,
 *      down-mixed, resampled to 16 kHz mono, peak-normalised and encoded as WAV
 *      (a format Sarvam STT accepts from every browser, incl. iOS Safari).
 */
export function useRecorder(maxSeconds: number) {
  const [state, setState] = useState<RecorderState>("idle");
  const [level, setLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const { t } = useLanguage();

  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const rafRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resolveRef = useRef<((b: Blob | null) => void) | null>(null);

  const cleanup = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    const ctx = ctxRef.current;
    ctxRef.current = null;
    if (ctx && ctx.state !== "closed") void ctx.close().catch(() => undefined);
    setLevel(0);
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const stop = useCallback(() => {
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }, []);

  /** Starts recording; resolves with a 16 kHz WAV Blob when recording stops (or null on failure). */
  const start = useCallback(async (): Promise<Blob | null> => {
    if (state === "recording" || state === "processing") return null;
    setError(null);
    setElapsed(0);
    setState("requesting");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { noiseSuppression: true, echoCancellation: true, autoGainControl: true, channelCount: 1 },
      });
      streamRef.current = stream;

      const AC: typeof AudioContext =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      ctxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const highpass = ctx.createBiquadFilter();
      highpass.type = "highpass";
      highpass.frequency.value = 120;
      highpass.Q.value = 0.7;
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = "lowpass";
      lowpass.frequency.value = 7000;
      lowpass.Q.value = 0.7;
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -28;
      compressor.knee.value = 20;
      compressor.ratio.value = 3;
      compressor.attack.value = 0.005;
      compressor.release.value = 0.2;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      const dest = ctx.createMediaStreamDestination();
      source.connect(highpass).connect(lowpass).connect(compressor);
      compressor.connect(analyser);
      compressor.connect(dest);

      // Level meter for the pulsing button.
      const buf = new Uint8Array(analyser.fftSize);
      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find(
        (m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(m),
      );
      const rec = new MediaRecorder(dest.stream, mime ? { mimeType: mime } : undefined);
      recRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);

      const result = new Promise<Blob | null>((resolve) => (resolveRef.current = resolve));
      rec.onstop = async () => {
        setState("processing");
        const sampleRate = ctx.sampleRate;
        const raw = new Blob(chunksRef.current, { type: rec.mimeType || mime || "audio/webm" });
        cleanup();
        let out: Blob | null = raw.size ? raw : null;
        try {
          if (raw.size) {
            const decodeCtx = new AC();
            const audioBuf = await decodeCtx.decodeAudioData(await raw.arrayBuffer());
            void decodeCtx.close();
            const channels = Array.from({ length: audioBuf.numberOfChannels }, (_, i) => audioBuf.getChannelData(i));
            const mono = normalizePeak(resampleLinear(mixToMono(channels), audioBuf.sampleRate || sampleRate, TARGET_RATE));
            out = new Blob([encodeWav(mono, TARGET_RATE)], { type: "audio/wav" });
          }
        } catch {
          // Some browsers can't decode their own recording format — send the original container instead.
        }
        setState("idle");
        resolveRef.current?.(out);
        resolveRef.current = null;
      };

      rec.start(250);
      setState("recording");
      const startedAt = Date.now();
      timerRef.current = setInterval(() => {
        const s = (Date.now() - startedAt) / 1000;
        setElapsed(s);
        if (s >= maxSeconds) stop();
      }, 200);
      return result;
    } catch (e) {
      cleanup();
      const name = (e as { name?: string })?.name;
      setError(
        name === "NotAllowedError"
          ? t("माइक की अनुमति नहीं मिली। ब्राउज़र सेटिंग में माइक चालू करें।", "Microphone permission denied. Turn on the mic in your browser settings.")
          : name === "NotFoundError"
            ? t("इस फ़ोन में माइक नहीं मिला।", "No microphone found on this phone.")
            : t("रिकॉर्डिंग शुरू नहीं हो सकी। यह ब्राउज़र आवाज़ रिकॉर्ड नहीं कर पा रहा।", "Could not start recording. This browser cannot record audio."),
      );
      setState("error");
      return null;
    }
  }, [cleanup, maxSeconds, state, stop, t]);

  return { state, level, elapsed, error, start, stop, isRecording: state === "recording" };
}
