"use client";
import { ChartColumn, FileDown, KeyRound, SquareKanban, LogOut, Map as MapIcon, Menu, Newspaper, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { Permission } from "@/lib/auth/rbac";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useAdmin } from "./AdminProvider";

const NAV: { href: string; label: string; icon: typeof SquareKanban; perm: Permission }[] = [
  { href: "/admin", label: "Ticket Board", icon: SquareKanban, perm: "tickets.view" },
  { href: "/admin/analytics", label: "Contractor Compliance", icon: ChartColumn, perm: "analytics.view" },
  { href: "/admin/heatmap", label: "Campus Heatmap", icon: MapIcon, perm: "heatmap.view" },
  { href: "/admin/content", label: "Content Manager", icon: Newspaper, perm: "content.manage" },
  { href: "/admin/reports", label: "Reports & Export", icon: FileDown, perm: "reports.export" },
  { href: "/admin/workers", label: "Worker PIN Reset", icon: KeyRound, perm: "workers.resetPin" },
  { href: "/admin/users", label: "Admin Users", icon: Users, perm: "users.manage" },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const { admin, can } = useAdmin();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="flex flex-col gap-1">
      {NAV.filter((n) => can(n.perm)).map((n) => {
        const active = n.href === "/admin" ? pathname === "/admin" : pathname.startsWith(n.href);
        const Icon = n.icon;
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
              active ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Icon className="size-4" aria-hidden /> {n.label}
          </Link>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="space-y-2 border-t border-white/10 pt-3 text-sm">
      <p className="truncate font-medium text-white">{admin.fullName}</p>
      <p className="text-xs text-slate-400">{admin.roleLabel}</p>
      <button
        onClick={async () => {
          await supabaseBrowser().auth.signOut();
          location.href = "/admin/login";
        }}
        className="flex items-center gap-2 text-slate-300 hover:text-white"
      >
        <LogOut className="size-4" aria-hidden /> Sign out
      </button>
    </div>
  );

  return (
    <div lang="en" className="min-h-dvh bg-slate-100 text-slate-900">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col justify-between bg-slate-900 p-4 lg:flex">
        <div className="space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">IIT Roorkee</p>
            <p className="text-lg font-bold leading-tight text-white">Worker Grievance Console</p>
          </div>
          {nav}
        </div>
        {footer}
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between bg-slate-900 px-4 py-3 text-white lg:hidden">
        <p className="font-bold">Grievance Console</p>
        <button onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu className="size-6" aria-hidden />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 bg-slate-900/60 lg:hidden" onClick={() => setOpen(false)}>
          <div className="flex h-full w-64 flex-col justify-between bg-slate-900 p-4" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-6">
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="text-white">
                <X className="size-6" aria-hidden />
              </button>
              {nav}
            </div>
            {footer}
          </div>
        </div>
      )}

      <main className="px-4 py-5 lg:ml-60 lg:px-8">{children}</main>
    </div>
  );
}
