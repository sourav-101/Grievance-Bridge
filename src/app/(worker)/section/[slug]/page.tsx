"use client";
/* eslint-disable @next/next/no-img-element */
import { Bot, IdCard, IndianRupee, Landmark, Scale, Stethoscope, type LucideIcon } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useLanguage } from "@/components/shared/LanguageProvider";
import { IconTile } from "@/components/worker/Pictos";
import { SunoButton } from "@/components/worker/SunoButton";
import { getJson } from "@/lib/client/api";
import { SECTIONS } from "@/lib/constants";
import type { KnowledgeItem } from "@/lib/types";

const SECTION_ICON: Record<string, LucideIcon> = {
  schemes: Landmark,
  wages: IndianRupee,
  health: Stethoscope,
  rights: Scale,
  checklist: IdCard,
};

/** Photo heroes: Thomason Building for schemes, IIT Roorkee hospital for health. */
const HERO_IMAGE: Record<string, { src: string; alt: string; caption: string; captionEn: string }> = {
  schemes: { src: "/images/thomason-building.jpg", alt: "Thomason Building, IIT Roorkee", caption: "थॉमसन भवन, IIT रुड़की", captionEn: "Thomason Building, IIT Roorkee" },
  health: { src: "/images/iitr-hospital.jpg", alt: "IIT Roorkee hospital emergency ward", caption: "IIT रुड़की अस्पताल — आपातकालीन कक्ष", captionEn: "IIT Roorkee hospital — emergency ward" },
};

/** Information section (schemes, wages, health camps, rights, document checklist). */
export default function SectionPage() {
  const { slug } = useParams<{ slug: string }>();
  const section = SECTIONS[slug];
  const [items, setItems] = useState<KnowledgeItem[] | null>(null);
  const [error, setError] = useState(false);
  const { lang, t } = useLanguage();

  useEffect(() => {
    if (!section) return;
    getJson<{ items: KnowledgeItem[] }>(`/api/content?section=${slug}`)
      .then((r) => setItems(r.items))
      .catch(() => setError(true));
  }, [slug, section]);

  if (!section) return <p className="p-6 text-xl">{t("यह पेज नहीं मिला।", "Page not found.")}</p>;

  // English mode shows the stored English copy; items not translated yet stay in Hindi.
  const english = lang === "en";
  const titleOf = (i: KnowledgeItem) => (english && i.title_english) || i.title;
  const bodyOf = (i: KnowledgeItem) => (english && i.content_english) || i.content_hindi;
  const untranslated = english && (items ?? []).some((i) => !i.content_english);
  const readAll = items?.map((i, n) => `${n + 1}. ${titleOf(i)}${english ? "." : "।"} ${bodyOf(i)}`).join(" ").slice(0, 2900) ?? "";
  const hero = HERO_IMAGE[slug];
  const Icon = SECTION_ICON[slug] ?? Landmark;

  return (
    <div>
      {hero ? (
        <header className="relative">
          <img src={hero.src} alt={hero.alt} className="h-56 w-full object-cover sm:h-80" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 mx-auto flex max-w-3xl items-end gap-3 px-4 pb-4 text-white">
            <IconTile icon={Icon} size="lg" />
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{t(section.titleHi, section.titleEn)}</h1>
              <p className="text-base text-white/90">{t(section.introHi, section.introEn)}</p>
            </div>
          </div>
          <p className="absolute right-2 top-2 rounded bg-black/50 px-2 py-0.5 text-xs text-white">{t(hero.caption, hero.captionEn)}</p>
        </header>
      ) : (
        <header className="ocean-band px-4 py-8 text-white">
          <div className="mx-auto flex max-w-3xl items-center gap-4">
            <IconTile icon={Icon} size="lg" tone="indigo" />
            <div>
              <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{t(section.titleHi, section.titleEn)}</h1>
              <p className="text-base text-white/90">{t(section.introHi, section.introEn)}</p>
            </div>
          </div>
        </header>
      )}

      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        {untranslated && (
          <p className="rounded-lg bg-white p-3 text-base text-ink-soft">Some details below are only available in Hindi for now.</p>
        )}
        {items && items.length > 1 && <SunoButton text={readAll} id={`all-${slug}`} label={t("पूरा पेज सुनें", "Listen to the whole page")} size="lg" />}

        {error && <p className="rounded-lg bg-danger/10 p-3 text-base font-semibold text-danger">{t("जानकारी लोड नहीं हुई। फिर से खोलें।", "Could not load the information. Please open it again.")}</p>}
        {!items && !error && <p className="py-8 text-center text-lg text-ink-soft">{t("लोड हो रहा है…", "Loading…")}</p>}
        {items?.length === 0 && <p className="rounded-xl bg-white p-4 text-lg">{t("अभी यहाँ कोई जानकारी नहीं है।", "No information here yet.")}</p>}

        <ul className="space-y-4">
          {items?.map((item) => (
            <li key={item.id} className="rounded-xl border border-line bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <h2 className="border-l-4 border-brand pl-3 text-xl font-bold leading-snug">{titleOf(item)}</h2>
                <SunoButton text={`${titleOf(item)}${english ? "." : "।"} ${bodyOf(item)}`} id={`kb-${item.id}`} />
              </div>
              {item.is_placeholder && (
                <p className="mt-3 inline-block rounded bg-orange/10 px-2.5 py-1 text-sm font-semibold text-orange">{t("जानकारी जल्द अपडेट होगी", "Will be updated soon")}</p>
              )}
              <p className="mt-3 whitespace-pre-line text-lg leading-relaxed text-ink">{bodyOf(item)}</p>
            </li>
          ))}
        </ul>

        <button
          onClick={() => window.dispatchEvent(new Event("open-assistant"))}
          className="flex w-full items-center gap-3 rounded-xl border border-indigo-soft bg-white p-4 text-left shadow-sm"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-indigo-deep text-white">
            <Bot className="size-6" aria-hidden />
          </span>
          <span className="text-base">
            <span className="block font-semibold text-indigo">{t("कोई और सवाल?", "Any other question?")}</span>
            <span className="text-ink-soft">{t("सहायक से पूछें — जैसे “ई-श्रम कार्ड कैसे बनेगा?”", "Ask the assistant — e.g. “How do I get an e-Shram card?”")}</span>
          </span>
        </button>
      </div>
    </div>
  );
}
