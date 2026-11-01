"use client";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { isSiteLanguage } from "@/lib/constants";
import { langOf, type Lang } from "@/lib/i18n";
import type { Dialect } from "@/lib/types";

export const LANGUAGE_KEY = "iitr.dialect";

interface LanguageCtx {
  /** Site language: "hindi" or "english" (decides both on-screen text and speech). */
  dialect: Dialect;
  /** On-screen language: "en" or "hi". */
  lang: Lang;
  setDialect: (d: Dialect) => void;
  /** True once the person has picked a language on this device. */
  hasLocalChoice: boolean;
  /**
   * False during the very first render (the saved choice is read from the browser
   * right after it). Anything that runs on page open and depends on the language —
   * speaking a prompt, a lookup that returns speech — should wait for this.
   */
  ready: boolean;
  /** Pick the on-screen string: t("होम", "Home"). */
  t: (hi: string, en: string) => string;
}

const Ctx = createContext<LanguageCtx | null>(null);

export function useLanguage(): LanguageCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useLanguage must be used inside <LanguageProvider>");
  return c;
}

function readStored(): Dialect | null {
  try {
    const v = localStorage.getItem(LANGUAGE_KEY);
    // A dialect picked before the site was limited to Hindi + English falls back to Hindi.
    return isSiteLanguage(v) ? v : null;
  } catch {
    return null;
  }
}

/**
 * Site-wide language choice, shared by the login pages and the worker portal.
 * Remembered on this device so the choice survives login and page reloads.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [dialect, setDialectState] = useState<Dialect>("hindi");
  const [hasLocalChoice, setHasLocalChoice] = useState(false);
  const [ready, setReady] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const stored = readStored();
    if (stored) {
      setDialectState(stored);
      setHasLocalChoice(true);
    }
    setReady(true);
  }, []);

  const lang = langOf(dialect);
  useEffect(() => {
    document.documentElement.lang = lang;
    if (pathname.startsWith("/admin")) return;
    // Next.js writes the metadata title (Hindi) after navigations; keep the tab title in the chosen language.
    const wanted = lang === "en" ? "Worker Help Portal · IIT Roorkee" : "श्रमिक सहायता पोर्टल · IIT Roorkee";
    const apply = () => {
      if (document.title !== wanted) document.title = wanted;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [lang, pathname]);

  const setDialect = useCallback((choice: Dialect) => {
    const d = isSiteLanguage(choice) ? choice : "hindi";
    setDialectState(d);
    setHasLocalChoice(true);
    try {
      localStorage.setItem(LANGUAGE_KEY, d);
    } catch {
      /* private mode: choice lasts for this page only */
    }
  }, []);

  const t = useCallback((hi: string, en: string) => (lang === "en" ? en : hi), [lang]);

  const value = useMemo(
    () => ({ dialect, lang, setDialect, hasLocalChoice, ready, t }),
    [dialect, lang, setDialect, hasLocalChoice, ready, t],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
