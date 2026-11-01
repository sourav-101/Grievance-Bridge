"use client";
import { FolderClock, House, Megaphone, Ticket, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/components/shared/LanguageProvider";

const ITEMS: { href: string; label: string; en: string; Icon: LucideIcon }[] = [
  { href: "/", label: "होम", en: "Home", Icon: House },
  { href: "/grievance", label: "शिकायत", en: "Complain", Icon: Megaphone },
  { href: "/history", label: "इतिहास", en: "History", Icon: FolderClock },
  { href: "/status", label: "टोकन", en: "Token", Icon: Ticket },
];

/** Simple bottom menu with line icons (active item in brand red). */
export function BottomNav() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  return (
    <nav
      aria-label={t("मुख्य मेनू", "Main menu")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white pb-[max(env(safe-area-inset-bottom),4px)] shadow-[0_-4px_16px_rgba(0,0,0,0.06)]"
    >
      <ul className="mx-auto flex max-w-2xl">
        {ITEMS.map(({ href, label, en, Icon }) => {
          const active = isActive(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative flex flex-col items-center gap-0.5 py-2 text-[13px] font-medium ${active ? "text-brand" : "text-ink-soft"}`}
              >
                {active && <span className="absolute inset-x-5 top-0 h-[3px] rounded-b bg-brand" aria-hidden />}
                <Icon className="size-6" strokeWidth={active ? 2 : 1.6} aria-hidden />
                {t(label, en)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
