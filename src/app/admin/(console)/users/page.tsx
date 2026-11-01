"use client";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";
import { ApiError, getJson, sendJson } from "@/lib/client/api";
import { ROLE_LABELS } from "@/lib/auth/rbac";
import type { AdminRole, Contractor } from "@/lib/types";

interface Row {
  id: string;
  email: string;
  full_name: string;
  role: AdminRole;
  contractor_id: string | null;
  is_active: boolean;
  contractors: { agency_name: string } | null;
}

const input = "mt-1 block h-10 w-full rounded-lg border border-slate-300 px-2 text-sm";

/** Dean-only RBAC management. */
export default function UsersPage() {
  const { admin, can } = useAdmin();
  const [users, setUsers] = useState<Row[] | null>(null);
  const [agencies, setAgencies] = useState<Contractor[]>([]);
  const [form, setForm] = useState<{ email: string; fullName: string; password: string; role: AdminRole; contractorId: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const reload = useCallback(() => {
    getJson<{ users: Row[] }>("/api/admin/users").then((r) => setUsers(r.users)).catch((e) => setMsg(e.message));
  }, []);
  useEffect(() => {
    reload();
    getJson<{ contractors: Contractor[] }>("/api/admin/contractors").then((r) => setAgencies(r.contractors)).catch(() => undefined);
  }, [reload]);

  if (!can("users.manage")) return <p>Only the Dean of Infrastructure can manage admin accounts.</p>;

  async function create() {
    if (!form) return;
    try {
      await sendJson("/api/admin/users", { ...form, contractorId: form.role === "contractor" ? form.contractorId || null : null });
      setForm(null);
      setMsg("Account created. Share the password securely; they can sign in at /admin/login.");
      reload();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Could not create account");
    }
  }

  async function update(id: string, body: Record<string, unknown>) {
    try {
      await sendJson(`/api/admin/users/${id}`, body, "PATCH");
      reload();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "Update failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Admin Users</h1>
          <p className="text-sm text-slate-500">Dean: everything · Estate Officer: tickets, content, analytics, exports · Contractor: own agency&apos;s named tickets only.</p>
        </div>
        <button
          onClick={() => setForm({ email: "", fullName: "", password: "", role: "estate_officer", contractorId: "" })}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white"
        >
          <Plus className="size-4" aria-hidden /> New account
        </button>
      </div>
      {msg && <p className="rounded-lg bg-slate-200 p-2 text-sm">{msg}</p>}

      {form && (
        <div className="grid gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:grid-cols-2">
          <label className="text-sm">
            Full name
            <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className={input} />
          </label>
          <label className="text-sm">
            Email
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={input} />
          </label>
          <label className="text-sm">
            Initial password (min 10 chars)
            <input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={input} autoComplete="new-password" />
          </label>
          <label className="text-sm">
            Role
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as AdminRole })} className={input}>
              {(Object.keys(ROLE_LABELS) as AdminRole[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </label>
          {form.role === "contractor" && (
            <label className="text-sm sm:col-span-2">
              Agency
              <select value={form.contractorId} onChange={(e) => setForm({ ...form, contractorId: e.target.value })} className={input}>
                <option value="">Select agency…</option>
                {agencies.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.agency_name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button onClick={() => setForm(null)} className="h-9 rounded-lg border border-slate-300 px-3 text-sm font-semibold">
              Cancel
            </button>
            <button
              onClick={create}
              disabled={!form.email || !form.fullName || form.password.length < 10 || (form.role === "contractor" && !form.contractorId)}
              className="h-9 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Agency</th>
              <th className="px-3 py-2">Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users?.map((u) => (
              <tr key={u.id}>
                <td className="px-3 py-2">
                  <p className="font-medium">{u.full_name}</p>
                  <p className="text-xs text-slate-500">{u.email}</p>
                </td>
                <td className="px-3 py-2">
                  <select
                    value={u.role}
                    disabled={u.id === admin.id}
                    onChange={(e) => {
                      const role = e.target.value as AdminRole;
                      if (role === "contractor" && !u.contractor_id) {
                        setMsg("Contractor accounts must be linked to an agency — create a new Contractor account for this person instead.");
                        return;
                      }
                      void update(u.id, { role });
                    }}
                    className="h-8 rounded border border-slate-300 px-1"
                  >
                    {(Object.keys(ROLE_LABELS) as AdminRole[]).map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  {u.role === "contractor" ? (
                    <select value={u.contractor_id ?? ""} onChange={(e) => void update(u.id, { contractorId: e.target.value })} className="h-8 rounded border border-slate-300 px-1">
                      {agencies.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.agency_name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <input type="checkbox" checked={u.is_active} disabled={u.id === admin.id} onChange={(e) => void update(u.id, { isActive: e.target.checked })} aria-label="Active" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
