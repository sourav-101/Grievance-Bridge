"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getJson } from "@/lib/client/api";
import type { Permission } from "@/lib/auth/rbac";
import type { AdminRole } from "@/lib/types";

export interface AdminInfo {
  id: string;
  email: string;
  fullName: string;
  role: AdminRole;
  roleLabel: string;
  contractorId: string | null;
}

interface AdminCtx {
  admin: AdminInfo;
  can: (p: Permission) => boolean;
}

const Ctx = createContext<AdminCtx | null>(null);

export function useAdmin(): AdminCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAdmin must be used inside <AdminProvider>");
  return c;
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ admin: AdminInfo; permissions: Permission[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getJson<{ admin: AdminInfo; permissions: Permission[] }>("/api/admin/me")
      .then(setState)
      .catch((e) => setError(e.message || "Not authorised"));
  }, []);

  if (error)
    return (
      <div lang="en" className="grid min-h-dvh place-items-center bg-slate-100 p-6 text-center">
        <div className="max-w-md space-y-3 rounded-2xl bg-white p-6 shadow">
          <p className="text-lg font-semibold text-slate-900">Access denied</p>
          <p className="text-slate-600">{error} Your account may not have an active admin role yet — ask the Dean to add it.</p>
          <a href="/admin/login" className="inline-block rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white">
            Back to sign in
          </a>
        </div>
      </div>
    );
  if (!state) return <div className="grid min-h-dvh place-items-center bg-slate-100 text-slate-500">Loading…</div>;

  return <Ctx.Provider value={{ admin: state.admin, can: (p) => state.permissions.includes(p) }}>{children}</Ctx.Provider>;
}
