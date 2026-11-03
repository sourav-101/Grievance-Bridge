"use client";
/* eslint-disable @next/next/no-img-element */
import {
  ArrowRight,
  Bot,
  FolderClock,
  Hospital,
  IdCard,
  ImageIcon,
  IndianRupee,
  KeyRound,
  Landmark,
  Languages,
  Phone,
  Scale,
  ShieldCheck,
  Siren,
  Stethoscope,
  Ticket,
  UserRound,
  VenetianMask,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useLanguage } from "@/components/shared/LanguageProvider";
import { useSpeech } from "@/components/shared/SpeechProvider";
import { GrievanceRecorderCard } from "@/components/worker/GrievanceRecorderCard";
import { MyRecentTickets, useMyTickets } from "@/components/worker/MyRecentTickets";
import { IconTile } from "@/components/worker/Pictos";
import { SunoButton } from "@/components/worker/SunoButton";
import { useWorker } from "@/components/worker/WorkerProvider";
import { useVoiceAgent } from "@/hooks/useVoiceAgent";
import { safeSession } from "@/lib/client/api";
import { spokenFor } from "@/lib/i18n/prompts";

const CATEGORIES: { href: string; label: string; en: string; icon: LucideIcon }[] = [
  { href: "/section/schemes", label: "सरकारी योजनाएं", en: "Government schemes", icon: Landmark },
  { href: "/section/wages", label: "वेतन / हाज़िरी", en: "Wages / Attendance", icon: IndianRupee },
  { href: "/section/health", label: "स्वास्थ्य शिविर", en: "Health camps", icon: Stethoscope },
  { href: "/section/checklist", label: "ज़रूरी कागज़", en: "Documents needed", icon: IdCard },
  { href: "/section/rights", label: "आपके अधिकार", en: "Your rights", icon: Scale },
  { href: "/status", label: "टोकन से स्थिति", en: "Status by token", icon: Ticket },
];

const HELPLINES: { label: string; en: string; icon: LucideIcon }[] = [
  { label: "कैंपस सुरक्षा", en: "Campus security", icon: ShieldCheck },
  { label: "IIT रुड़की अस्पताल", en: "IIT Roorkee hospital", icon: Hospital },
  { label: "महिला प्रकोष्ठ", en: "Women's cell", icon: UserRound },
  { label: "राष्ट्रीय आपातकाल 112", en: "National emergency 112", icon: Phone },
];

function SectionHeading({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return <h2 className={`section-title ${dark ? "on-dark text-white" : "text-ink"}`}>{children}</h2>;
}

/**
 * Home (india.gov.in-style bands):
 *   1. red band — "शिकायत दर्ज करें" recorder + quick tiles   2. my logged complaints (right below)
 *   3. information categories   4. photo cards (Thomason Building → schemes, hospital → health)
 *   5. helplines directory   6. indigo help band
 */
export default function HomePage() {
  const { profile, setEmergencyOpen } = useWorker();
  const { speakText } = useSpeech();
  const { dialect, t, ready } = useLanguage();
  const voice = useVoiceAgent("grievance"); // result opens the confirm sheet (with anonymous option)
  const tickets = useMyTickets();
  const greeted = useRef(false);
  const greeting = profile ? spokenFor(dialect).greeting(profile.fullName) : "";
  const open = tickets?.filter((tk) => tk.status !== "Resolved").length ?? 0;
  const resolved = tickets?.filter((tk) => tk.status === "Resolved").length ?? 0;

  useEffect(() => {
    if (!profile || !ready || greeted.current) return;
    greeted.current = true;
    if (safeSession.get("iitr.greeted", false)) return;
    safeSession.set("iitr.greeted", true);
    void speakText(greeting, { id: "greeting" });
  }, [profile, ready, greeting, speakText]);

  const statTiles: { href: string; value: string; label: string; icon: LucideIcon }[] = [
    { href: "/history", value: tickets ? String(open) : "–", label: t("चल रही शिकायतें", "Open complaints"), icon: FolderClock },
    { href: "/history", value: tickets ? String(resolved) : "–", label: t("हल हुई शिकायतें", "Resolved complaints"), icon: ShieldCheck },
    { href: "/status", value: "", label: t("टोकन से स्थिति", "Status by token"), icon: Ticket },
    { href: "/grievance", value: "", label: t("तस्वीर से शिकायत", "Complain with pictures"), icon: ImageIcon },
  ];

  return (
    <div>
      {/* 1 ───────────── Grievance band (top) */}
      <section className="hero-band px-4 pb-10 pt-7 text-white">
        <div className="mx-auto max-w-3xl space-y-5">
          <div className="text-center">
            <SectionHeading dark>{t("शिकायत दर्ज करें", "File a complaint")}</SectionHeading>
            <p className="mt-2 text-base text-white/90">
              {profile ? t(`नमस्ते ${profile.fullName} जी। `, `Hello ${profile.fullName}. `) : ""}
              {t("अपनी समस्या बोलकर बताएं — आपको टोकन नंबर मिलेगा।", "Speak your problem — you will get a token number.")}
            </p>
          </div>
          <GrievanceRecorderCard voice={voice} />
          <div className="grid grid-cols-4 gap-2">
            {statTiles.map((tile) => (
              <Link
                key={tile.label}
                href={tile.href}
                className="flex flex-col items-center gap-1 rounded-2xl border border-white/25 bg-white/10 px-1 py-3 text-center backdrop-blur-sm transition hover:bg-white/20"
              >
                <tile.icon className="size-7" strokeWidth={1.5} aria-hidden />
                {tile.value && <span className="text-xl font-bold leading-none">{tile.value}</span>}
                <span className="text-[12px] font-medium uppercase leading-tight">{tile.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 2 ───────────── My logged complaints, right below */}
      <section className="px-4 py-8">
        <div className="mx-auto max-w-3xl space-y-5">
          <SectionHeading>{t("मेरी दर्ज शिकायतें", "My complaints")}</SectionHeading>
          <MyRecentTickets tickets={tickets} limit={3} />
        </div>
      </section>

      {/* 3 ───────────── Information categories */}
      <section className="bg-white px-4 py-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <SectionHeading>{t("जानकारी श्रेणियां", "Information")}</SectionHeading>
          <div className="grid grid-cols-3 gap-3">
            {CATEGORIES.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className="card-lift relative flex flex-col items-center gap-3 rounded-2xl border border-line bg-white px-2 pb-4 pt-5 text-center"
              >
                <IconTile icon={c.icon} size="lg" />
                <span className="text-[15px] font-semibold leading-snug">{t(c.label, c.en)}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 4 ───────────── Featured: photo cards */}
      <section className="px-4 py-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <SectionHeading>{t("मुख्य जानकारी", "Featured")}</SectionHeading>
          <div className="grid gap-4 sm:grid-cols-2">
            <Link href="/section/schemes" className="card-lift group overflow-hidden rounded-2xl bg-white">
              <img src="/images/government-schemes.svg" alt={t("सरकारी योजनाएं: पहचान पत्र, बचत, बीमा और स्वास्थ्य", "Government schemes: ID card, savings, insurance and health")} className="aspect-[16/9] w-full object-cover" />
              <div className="flex items-center gap-3 p-4">
                <div className="flex-1">
                  <p className="text-lg font-semibold">{t("सरकारी योजनाएं", "Government schemes")}</p>
                  <p className="text-sm text-ink-soft">{t("ई-श्रम, आयुष्मान, पेंशन और बीमा योजनाएं", "e-Shram, Ayushman, pension and insurance schemes")}</p>
                </div>
                <ArrowRight className="size-6 text-brand transition group-hover:translate-x-1" aria-hidden />
              </div>
            </Link>
            <Link href="/section/health" className="card-lift group overflow-hidden rounded-2xl bg-white">
              <img src="/images/iitr-hospital.jpg" alt={t("IIT रुड़की अस्पताल का आपातकालीन कक्ष", "Emergency ward, IIT Roorkee hospital")} className="aspect-[16/9] w-full object-cover" />
              <div className="flex items-center gap-3 p-4">
                <div className="flex-1">
                  <p className="text-lg font-semibold">{t("स्वास्थ्य शिविर और अस्पताल", "Health camps and hospital")}</p>
                  <p className="text-sm text-ink-soft">{t("IIT रुड़की अस्पताल का समय, स्वास्थ्य शिविर", "IIT Roorkee hospital timings, health camps")}</p>
                </div>
                <ArrowRight className="size-6 text-brand transition group-hover:translate-x-1" aria-hidden />
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* 5 ───────────── Helplines (directory style) */}
      <section className="bg-white px-4 py-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <SectionHeading>{t("आपातकालीन नंबर", "Emergency numbers")}</SectionHeading>
          <div className="grid grid-cols-2 gap-3">
            {HELPLINES.map((h) => (
              <button
                key={h.label}
                onClick={() => setEmergencyOpen(true)}
                className="card-lift flex flex-col items-center gap-2 rounded-2xl border border-line bg-white px-2 py-5 text-center"
              >
                <h.icon className="size-11 text-brand" strokeWidth={1.4} aria-hidden />
                <span className="text-base text-ink">{t(h.label, h.en)}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 6 ───────────── Help band (indigo) */}
      <section className="ocean-band px-4 py-9 text-white">
        <div className="mx-auto max-w-3xl space-y-6">
          <SectionHeading dark>{t("सहायता", "Help")}</SectionHeading>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: t("सहायक से पूछें", "Ask the assistant"), icon: Bot, onClick: () => window.dispatchEvent(new Event("open-assistant")) },
              { label: t("आपातकाल", "Emergency"), icon: Siren, onClick: () => setEmergencyOpen(true) },
              { label: t("गुमनाम शिकायत", "Anonymous complaint"), icon: VenetianMask, href: "/section/rights" },
              { label: t("PIN भूल गए?", "Forgot PIN?"), icon: KeyRound, onClick: () => window.dispatchEvent(new Event("open-assistant")) },
            ].map((item) =>
              item.href ? (
                <Link key={item.label} href={item.href} className="flex flex-col items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-2 py-5 text-center backdrop-blur-sm transition hover:bg-white/15">
                  <item.icon className="size-10" strokeWidth={1.4} aria-hidden />
                  <span className="text-base font-semibold">{item.label}</span>
                </Link>
              ) : (
                <button key={item.label} onClick={item.onClick} className="flex flex-col items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-2 py-5 text-center backdrop-blur-sm transition hover:bg-white/15">
                  <item.icon className="size-10" strokeWidth={1.4} aria-hidden />
                  <span className="text-base font-semibold">{item.label}</span>
                </button>
              ),
            )}
          </div>
          <div className="flex items-center justify-center gap-3 text-sm text-white/90">
            <Languages className="size-5" aria-hidden /> {t("ऊपर “अ/A” बटन से भाषा बदलें", "Change language with the “अ/A” button at the top")}
            {profile && <SunoButton text={greeting} id="greeting" tone="light" label="" />}
          </div>
        </div>
      </section>
    </div>
  );
}
