"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLanguage } from "@/components/shared/LanguageProvider";
import { getJson, safeSession, sendJson } from "@/lib/client/api";
import type { Dialect, GrievanceCategory, SpeechPayload, WorkerTicketView } from "@/lib/types";

export interface WorkerProfile {
  id: string;
  fullName: string;
  age: number | null;
  dialect: Dialect;
  workType: string | null;
  contractorId: string | null;
  agencyName: string | null;
}

export interface GrievanceDraft {
  token: string;
  category: GrievanceCategory;
  zoneId: string | null;
  locationText: string;
  isEmergency: boolean;
}

export type VoiceResult =
  | {
      type: "answer";
      transcript: string;
      card: { title: string; text: string; source: "rag" | "web" | "none"; confidence: number | null; references: { title: string; url?: string }[] };
      speech: SpeechPayload;
    }
  | { type: "grievance_draft"; transcript: string; draft: GrievanceDraft; speech: SpeechPayload }
  | { type: "status"; transcript: string; ticket: WorkerTicketView | null; isOwner?: boolean; speech: SpeechPayload }
  | { type: "help" | "empty"; transcript: string; speech: SpeechPayload };

export interface RecentQuery {
  id: string;
  question: string;
  answer: string;
  kind: VoiceResult["type"];
  at: number;
}

interface WorkerCtx {
  profile: WorkerProfile | null;
  dialect: Dialect;
  setDialect: (d: Dialect) => void;
  result: VoiceResult | null;
  showResult: (r: VoiceResult | null) => void;
  recent: RecentQuery[];
  emergencyOpen: boolean;
  setEmergencyOpen: (open: boolean) => void;
  refreshProfile: () => Promise<void>;
}

const Ctx = createContext<WorkerCtx | null>(null);

export function useWorker(): WorkerCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useWorker must be used inside <WorkerProvider>");
  return c;
}

const RECENT_KEY = "iitr.recentQueries";

export function WorkerProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const { dialect, setDialect: setSiteDialect, hasLocalChoice } = useLanguage();
  const [result, setResult] = useState<VoiceResult | null>(null);
  const [recent, setRecent] = useState<RecentQuery[]>([]);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const refreshProfile = useCallback(async () => {
    try {
      const me = await getJson<{ profile: WorkerProfile | null }>("/api/me");
      if (me.profile) setProfile(me.profile);
    } catch {
      /* redirect handled by api helper on 401 */
    }
  }, []);

  useEffect(() => {
    void refreshProfile();
    setRecent(safeSession.get<RecentQuery[]>(RECENT_KEY, []));
  }, [refreshProfile]);

  // The choice made on this device wins; otherwise use the language saved in the profile.
  useEffect(() => {
    if (!profile) return;
    if (!hasLocalChoice) setSiteDialect(profile.dialect);
    else if (profile.dialect !== dialect) void sendJson("/api/profile", { dialect }, "PATCH").catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const setDialect = useCallback(
    (d: Dialect) => {
      setSiteDialect(d);
      setProfile((p) => (p ? { ...p, dialect: d } : p));
      void sendJson("/api/profile", { dialect: d }, "PATCH").catch(() => undefined);
    },
    [setSiteDialect],
  );

  const showResult = useCallback((r: VoiceResult | null) => {
    setResult(r);
    if (!r || r.type === "empty" || !r.transcript) return;
    const answer = r.type === "answer" ? r.card.text : r.speech.text;
    setRecent((prev) => {
      const next = [{ id: `${Date.now()}`, question: r.transcript, answer, kind: r.type, at: Date.now() }, ...prev].slice(0, 10);
      safeSession.set(RECENT_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ profile, dialect, setDialect, result, showResult, recent, emergencyOpen, setEmergencyOpen, refreshProfile }),
    [profile, dialect, setDialect, result, showResult, recent, emergencyOpen, refreshProfile],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
