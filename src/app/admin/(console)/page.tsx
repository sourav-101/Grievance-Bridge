"use client";
import { Camera, TriangleAlert, EyeOff, Layers, Mic, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAdmin } from "@/components/admin/AdminProvider";
import { TicketModal } from "@/components/admin/TicketModal";
import { CATEGORY_STYLE, STATUS_COLUMN_STYLE, timeAgo, type TicketCard } from "@/components/admin/types";
import { CAMPUS_ZONES } from "@/lib/campus";
import { ApiError, getJson, sendJson } from "@/lib/client/api";
import { GRIEVANCE_CATEGORY_IDS, STATUSES } from "@/lib/constants";
import { allowedTargetStatuses } from "@/lib/auth/rbac";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { GrievanceStatus } from "@/lib/types";

/** Real-time Kanban board (Supabase Realtime → refetch through the RBAC-filtered API). */
export default function BoardPage() {
  const { admin } = useAdmin();
  const [tickets, setTickets] = useState<TicketCard[] | null>(null);
  const [filters, setFilters] = useState({ category: "", zone: "", emergency: false });
  const [openId, setOpenId] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const known = useRef<Set<string> | null>(null);

  const load = useCallback(async () => {
    const qs = new URLSearchParams();
    if (filters.category) qs.set("category", filters.category);
    if (filters.zone) qs.set("zone", filters.zone);
    if (filters.emergency) qs.set("emergency", "1");
    try {
      const r = await getJson<{ tickets: TicketCard[] }>(`/api/admin/grievances?${qs}`);
      // Alert on newly arrived emergencies.
      if (known.current) {
        const fresh = r.tickets.filter((t) => !known.current!.has(t.id));
        const emergency = fresh.find((t) => t.isEmergency);
        if (emergency) setToast(`🚨 New EMERGENCY ticket #${emergency.token} at ${emergency.location}`);
        else if (fresh.length) setToast(`${fresh.length} new ticket${fresh.length > 1 ? "s" : ""}`);
      }
      known.current = new Set(r.tickets.map((t) => t.id));
      setTickets(r.tickets);
    } catch (e) {
      setToast(e instanceof ApiError ? e.message : "Could not load tickets");
    }
  }, [filters]);

  useEffect(() => {
    // New filter = new result set: don't announce its tickets as "new".
    known.current = null;
    void load();
  }, [load]);

  // Supabase Realtime: RLS ensures each role only receives rows it may see; we refetch via the API
  // so identities are filtered server-side.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabaseBrowser()
      .channel("grievances-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "grievances" }, () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => void load(), 400);
      })
      .subscribe((status: string) => setLive(status === "SUBSCRIBED"));
    return () => {
      if (timer) clearTimeout(timer);
      void supabaseBrowser().removeChannel(channel);
    };
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const columns = useMemo(() => {
    const by: Record<GrievanceStatus, TicketCard[]> = { New: [], "Under Review": [], "In Progress": [], Resolved: [] };
    for (const t of tickets ?? []) by[t.status].push(t);
    return by;
  }, [tickets]);

  const allowed = allowedTargetStatuses(admin.role);

  async function move(id: string, status: GrievanceStatus) {
    const t = tickets?.find((x) => x.id === id);
    if (!t || t.status === status) return;
    if (!allowed.includes(status)) {
      setToast(`Your role cannot move tickets to "${status}".`);
      return;
    }
    setTickets((prev) => prev?.map((x) => (x.id === id ? { ...x, status } : x)) ?? prev);
    try {
      await sendJson(`/api/admin/grievances/${id}`, { status }, "PATCH");
    } catch (e) {
      setToast(e instanceof ApiError ? e.message : "Update failed");
      void load();
    }
  }

  const emergencyOpen = (tickets ?? []).filter((t) => t.isEmergency && t.status !== "Resolved").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Ticket Board</h1>
          <p className="flex items-center gap-2 text-sm text-slate-500">
            <span className={`inline-block size-2 rounded-full ${live ? "bg-emerald-500" : "bg-slate-400"}`} />
            {live ? "Live updates on" : "Connecting to live updates…"}
            {admin.role === "contractor" && " · Showing your agency's named tickets only"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {emergencyOpen > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-600 px-3 py-1 text-sm font-semibold text-white">
              <TriangleAlert className="size-4" aria-hidden /> {emergencyOpen} open emergenc{emergencyOpen > 1 ? "ies" : "y"}
            </span>
          )}
          <select
            value={filters.category}
            onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
            className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm"
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            {GRIEVANCE_CATEGORY_IDS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select
            value={filters.zone}
            onChange={(e) => setFilters((f) => ({ ...f, zone: e.target.value }))}
            className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm"
            aria-label="Filter by location"
          >
            <option value="">All locations</option>
            {CAMPUS_ZONES.map((z) => (
              <option key={z.id} value={z.id}>
                {z.nameEn}
              </option>
            ))}
          </select>
          <label className="flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm">
            <input type="checkbox" checked={filters.emergency} onChange={(e) => setFilters((f) => ({ ...f, emergency: e.target.checked }))} />
            Emergencies only
          </label>
          <button onClick={() => void load()} className="grid size-9 place-items-center rounded-lg border border-slate-300 bg-white" aria-label="Refresh">
            <RefreshCw className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      {!tickets ? (
        <p className="py-16 text-center text-slate-500">Loading tickets…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {STATUSES.map((status) => (
            <section
              key={status}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dragId && void move(dragId, status)}
              className={`flex min-h-48 flex-col rounded-xl border-t-4 bg-slate-200/60 p-2 ${STATUS_COLUMN_STYLE[status]}`}
              aria-label={status}
            >
              <h2 className="flex items-center justify-between px-1 pb-2 text-sm font-semibold text-slate-700">
                {status} <span className="rounded-full bg-white px-2 text-xs">{columns[status].length}</span>
              </h2>
              <div className="flex flex-col gap-2">
                {columns[status].map((t) => (
                  <article
                    key={t.id}
                    draggable
                    onDragStart={() => setDragId(t.id)}
                    onDragEnd={() => setDragId(null)}
                    onClick={() => setOpenId(t.id)}
                    onKeyDown={(e) => e.key === "Enter" && setOpenId(t.id)}
                    tabIndex={0}
                    role="button"
                    className={`cursor-pointer rounded-lg bg-white p-3 text-sm shadow-sm ring-1 transition hover:shadow-md ${
                      t.isEmergency ? "ring-2 ring-red-500" : "ring-slate-200"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-slate-500">#{t.token}</span>
                      <span className="text-xs text-slate-400">{timeAgo(t.createdAt)}</span>
                    </div>
                    {t.isEmergency && (
                      <p className="mb-1 flex items-center gap-1 text-xs font-bold uppercase text-red-600">
                        <TriangleAlert className="size-3.5" aria-hidden /> Emergency
                      </p>
                    )}
                    <p className="line-clamp-3 text-slate-800">{t.summaryEnglish}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${CATEGORY_STYLE[t.category]}`}>{t.category}</span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{t.location}</span>
                      {t.duplicateCount > 0 && (
                        <span className="flex items-center gap-1 rounded bg-indigo-100 px-1.5 py-0.5 text-xs font-medium text-indigo-700" title="Clustered duplicate reports">
                          <Layers className="size-3" aria-hidden /> +{t.duplicateCount}
                        </span>
                      )}
                      {t.isAnonymous && (
                        <span className="flex items-center gap-1 rounded bg-violet-100 px-1.5 py-0.5 text-xs font-medium text-violet-700">
                          <EyeOff className="size-3" aria-hidden /> Anonymous
                        </span>
                      )}
                      {t.hasAudio && <Mic className="size-3.5 text-slate-400" aria-label="Has voice note" />}
                      {t.hasPhoto && <Camera className="size-3.5 text-slate-400" aria-label="Has photo" />}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {openId && <TicketModal id={openId} onClose={() => setOpenId(null)} onChanged={() => void load()} />}

      {toast && (
        <div role="status" className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
