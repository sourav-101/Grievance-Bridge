"use client";
import { ChevronRight, LogOut, Siren, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ChatAssistant } from "@/components/shared/ChatAssistant";
import { LanguageMenu } from "@/components/shared/LanguageMenu";
import { useLanguage } from "@/components/shared/LanguageProvider";
import { IitrBanner } from "@/components/shared/IitrBanner";
import { SiteFooter } from "@/components/shared/SiteFooter";
import { sendJson } from "@/lib/client/api";
import { BottomNav } from "./BottomNav";
import { EmergencyModal } from "./EmergencyModal";
import {
  DocumentsPicto,
  GrievancePicto,
  HealthPicto,
  HistoryPicto,
  HomePicto,
  RightsPicto,
  SchemesPicto,
  TokenPicto,
  WagesPicto,
} from "./Pictos";
import { VoiceSheet } from "./VoiceSheet";
import { useWorker } from "./WorkerProvider";

const MENU = [
  { href: "/", label: "होम", en: "Home", Icon: HomePicto },
  { href: "/grievance", label: "शिकायत दर्ज करें", en: "File a complaint", Icon: GrievancePicto },
  { href: "/history", label: "मेरा इतिहास", en: "My history", Icon: HistoryPicto },
  { href: "/status", label: "टोकन से स्थिति", en: "Status by token", Icon: TokenPicto },
  { href: "/section/schemes", label: "सरकारी योजनाएं", en: "Government schemes", Icon: SchemesPicto },
  { href: "/section/wages", label: "वेतन / हाज़िरी", en: "Wages / Attendance", Icon: WagesPicto },
  { href: "/section/health", label: "स्वास्थ्य शिविर", en: "Health camps", Icon: HealthPicto },
  { href: "/section/checklist", label: "ज़रूरी कागज़", en: "Documents needed", Icon: DocumentsPicto },
  { href: "/section/rights", label: "आपके अधिकार", en: "Your rights", Icon: RightsPicto },
];

/** Three-line menu icon in the tricolour, like india.gov.in. */
function TricolourMenuIcon() {
  return (
    <span className="flex w-7 flex-col gap-[5px]" aria-hidden>
      <span className="h-[3px] rounded bg-orange" />
      <span className="h-[3px] rounded bg-line" />
      <span className="h-[3px] rounded bg-ok" />
    </span>
  );
}

export function WorkerShell({ children }: { children: ReactNode }) {
  const { setDialect, emergencyOpen, setEmergencyOpen } = useWorker();
  const { t } = useLanguage();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <IitrBanner />

      {/* Sticky toolbar */}
      <div className="sticky top-0 z-30 border-b border-line bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center gap-1 px-3 py-2">
          <Link href="/" className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-xl font-bold text-brand-dark">{t("श्रमिक सहायता पोर्टल", "Worker Portal")}</span>
            <span className="mt-0.5 block h-[3px] w-24 rounded bg-gradient-to-r from-orange via-white to-ok" aria-hidden />
            <span className="block text-xs text-ink-soft">{t("Contract Worker Help Portal", "IIT Roorkee · Contract workers")}</span>
          </Link>

          <LanguageMenu onChange={setDialect} />

          <button
            onClick={() => setEmergencyOpen(true)}
            aria-label={t("आपातकालीन नंबर", "Emergency numbers")}
            className="flex h-12 flex-col items-center justify-center rounded-lg px-2 text-danger"
          >
            <Siren className="size-6" strokeWidth={1.7} aria-hidden />
            <span className="text-[11px] font-semibold">{t("आपातकाल", "Emergency")}</span>
          </button>

          <button onClick={() => setMenuOpen(true)} aria-label={t("मेनू खोलें", "Open menu")} className="grid size-12 place-items-center rounded-lg">
            <TricolourMenuIcon />
          </button>
        </div>
      </div>

      <main className="mx-auto w-full max-w-6xl flex-1 pb-10">{children}</main>

      <SiteFooter />

      <BottomNav />
      <ChatAssistant onEmergency={() => setEmergencyOpen(true)} raised speakReplies />
      <VoiceSheet />
      <EmergencyModal open={emergencyOpen} onClose={() => setEmergencyOpen(false)} />

      {/* Slide-in menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-[60] bg-black/40" onClick={() => setMenuOpen(false)}>
          <nav
            aria-label={t("पूरा मेनू", "Full menu")}
            onClick={(e) => e.stopPropagation()}
            className="ml-auto flex h-full w-[85%] max-w-sm flex-col bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="text-lg font-bold">{t("मेनू", "Menu")}</p>
              <button onClick={() => setMenuOpen(false)} aria-label={t("मेनू बंद करें", "Close menu")} className="grid size-11 place-items-center rounded-full hover:bg-paper">
                <X className="size-6" aria-hidden />
              </button>
            </div>
            <ul className="flex-1 overflow-y-auto py-2">
              {MENU.map(({ href, label, en, Icon }) => {
                const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={() => setMenuOpen(false)}
                      className={`flex items-center gap-4 px-5 py-3.5 text-lg ${active ? "bg-brand/5 font-semibold text-brand" : "text-ink"}`}
                    >
                      <Icon className="size-6 shrink-0" />
                      <span className="flex-1">{t(label, en)}</span>
                      <ChevronRight className="size-5 text-ink-soft" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
            <button
              onClick={async () => {
                await sendJson("/api/auth/logout", {}).catch(() => undefined);
                location.href = "/login";
              }}
              className="flex items-center gap-4 border-t border-line px-5 py-4 text-lg text-ink-soft"
            >
              <LogOut className="size-6" aria-hidden /> {t("लॉग आउट", "Log out")}
            </button>
          </nav>
        </div>
      )}
    </div>
  );
}
