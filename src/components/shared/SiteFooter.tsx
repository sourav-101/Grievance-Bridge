"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useLanguage } from "./LanguageProvider";

const LINKS = [
  { href: "/grievance", label: "शिकायत दर्ज करें", en: "File a complaint" },
  { href: "/history", label: "मेरा इतिहास", en: "My history" },
  { href: "/status", label: "टोकन से स्थिति", en: "Status by token" },
  { href: "/section/schemes", label: "सरकारी योजनाएं", en: "Government schemes" },
  { href: "/section/wages", label: "वेतन / हाज़िरी", en: "Wages / Attendance" },
  { href: "/section/health", label: "स्वास्थ्य शिविर", en: "Health camps" },
];

/** Black footer in the india.gov.in style. */
export function SiteFooter({ links = true }: { links?: boolean }) {
  const { t } = useLanguage();
  return (
    <footer className={`bg-footer px-5 pt-8 text-white/90 ${links ? "pb-28" : "pb-24"}`}>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center gap-3">
          <img src="/images/iitr-logo.png" alt="" className="size-12 rounded-full" />
          <div className="leading-tight">
            <p className="font-semibold">{t("श्रमिक सहायता पोर्टल", "Worker Help Portal")}</p>
            <p className="text-sm text-white/70">Estate Office, IIT Roorkee</p>
          </div>
        </div>
        {links && (
          <nav aria-label={t("फ़ुटर लिंक", "Footer links")} className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/15 pt-5 text-base sm:grid-cols-3">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-white hover:underline">
                {t(l.label, l.en)}
              </Link>
            ))}
          </nav>
        )}
        <p className="border-t border-white/15 pt-4 text-sm text-white/60">
          © Indian Institute of Technology Roorkee · {t("ठेका श्रमिकों के लिए सूचना और शिकायत पोर्टल", "Information and complaint portal for contract workers")}
        </p>
      </div>
    </footer>
  );
}
