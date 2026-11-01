"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { getJson } from "@/lib/client/api";
import type { ZoneAggregate } from "@/lib/admin/analytics";
import { GRIEVANCE_CATEGORY_IDS } from "@/lib/constants";

const CampusMap = dynamic(() => import("@/components/admin/CampusMap"), {
  ssr: false,
  loading: () => <div className="grid h-[60vh] place-items-center rounded-xl bg-slate-200 text-slate-500">Loading map…</div>,
});

/** Campus spatial heatmap of grievance clusters. */
export default function HeatmapPage() {
  const [days, setDays] = useState(30);
  const [category, setCategory] = useState("");
  const [openOnly, setOpenOnly] = useState(false);
  const [data, setData] = useState<{ center: { lat: number; lng: number }; zones: ZoneAggregate[]; total: number } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const qs = new URLSearchParams({ days: String(days) });
    if (category) qs.set("category", category);
    if (openOnly) qs.set("openOnly", "1");
    getJson<typeof data>(`/api/admin/heatmap?${qs}`)
      .then(setData)
      .catch(() => setData({ center: { lat: 29.8649, lng: 77.8966 }, zones: [], total: 0 }));
  }, [days, category, openOnly]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Campus Heatmap</h1>
          <p className="text-sm text-slate-500">Recurring grievance clusters by campus zone. Zone coordinates are approximate — verify in src/lib/campus.ts.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm" aria-label="Period">
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
            <option value={365}>12 months</option>
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm" aria-label="Category">
            <option value="">All categories</option>
            {GRIEVANCE_CATEGORY_IDS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <label className="flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm">
            <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} /> Open only
          </label>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_20rem]">
        <div className="overflow-hidden rounded-xl bg-white p-2 shadow-sm ring-1 ring-slate-200">
          {data && <CampusMap center={data.center} zones={data.zones} onSelect={setSelected} />}
        </div>
        <aside className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-2 font-semibold">Hotspots {data && <span className="text-sm font-normal text-slate-500">({data.total} reports)</span>}</h2>
          {data?.zones.length === 0 && <p className="text-sm text-slate-500">No reports in this period.</p>}
          <ol className="space-y-1.5 text-sm">
            {data?.zones.map((z, i) => (
              <li key={z.zoneId}>
                <button
                  onClick={() => setSelected(z.zoneId)}
                  className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left ${selected === z.zoneId ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`}
                >
                  <span>
                    {i + 1}. {z.nameEn}
                    {z.emergencies > 0 && <span className="ml-1 text-red-500">●</span>}
                  </span>
                  <span className="tabular-nums">{z.total}</span>
                </button>
                {selected === z.zoneId && (
                  <p className="px-2 pt-1 text-xs text-slate-600">
                    {z.open} open · {Object.entries(z.byCategory).map(([c, n]) => `${c} ${n}`).join(" · ")}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}
