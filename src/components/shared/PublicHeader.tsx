"use client";
import { LanguageMenu } from "./LanguageMenu";
import { useLanguage } from "./LanguageProvider";

/** Title strip for the login / sign-up pages, with the language button. */
export function PublicHeader() {
  const { t } = useLanguage();
  return (
    <div className="border-b border-line bg-white px-4 py-1.5 shadow-sm">
      <div className="mx-auto flex max-w-lg items-center gap-2">
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-xl font-bold text-brand-dark">{t("श्रमिक सहायता पोर्टल", "Worker Help Portal")}</p>
          <span className="mt-0.5 block h-[3px] w-24 rounded bg-gradient-to-r from-orange via-white to-ok" aria-hidden />
          <p className="text-xs text-ink-soft">{t("Contract Worker Help Portal", "IIT Roorkee · Contract workers")}</p>
        </div>
        <LanguageMenu />
      </div>
    </div>
  );
}
