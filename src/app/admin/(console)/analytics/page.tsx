"use client";
import { useEffect, useState } from "react";
import { getJson } from "@/lib/client/api";
import type { ContractorScore } from "@/lib/admin/analytics";

interface Analytics {
  summary: {
    totalReports: number;
    masterTickets: number;
    openTickets: number;
    openEmergencies: number;
    avgResolutionHours: number | null;
    satisfactionRate: number | null;
  };
  byCategory: Record<string, number>;
  contractors: ContractorScore[];
  unassigned: number;
  formula: string[];
}

const GRADE_STYLE: Record<string, string> = {
  A: "bg-emerald-600 text-white",
  B: "bg-lime-500 text-slate-900",
  C: "bg-amber-400 text-slate-900",
  D: "bg-red-600 text-white",
};

function Tile({ label, value, tone = "" }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className={`rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 ${tone}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

/** Contractor compliance scoring dashboard. */
export default function AnalyticsPage() {
  const [days, setDays] = useState(90);
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    getJson<Analytics>(`/api/admin/analytics?days=${days}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [days]);

  const maxCat = Math.max(1, ...Object.values(data?.byCategory ?? {}));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Contractor Compliance</h1>
          <p className="text-sm text-slate-500">Agencies ranked worst-first by compliance score.</p>
        </div>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm" aria-label="Period">
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last 12 months</option>
          <option value={0}>All time</option>
        </select>
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {!data && !error && <p className="py-10 text-center text-slate-500">Loading…</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Tile label="Reports" value={data.summary.totalReports} />
            <Tile label="Unique issues" value={data.summary.masterTickets} />
            <Tile label="Open" value={data.summary.openTickets} />
            <Tile label="Open emergencies" value={data.summary.openEmergencies} tone={data.summary.openEmergencies ? "ring-2 ring-red-500" : ""} />
            <Tile label="Avg. resolution" value={data.summary.avgResolutionHours === null ? "—" : `${data.summary.avgResolutionHours} h`} />
            <Tile label="Satisfied" value={data.summary.satisfactionRate === null ? "—" : `${Math.round(data.summary.satisfactionRate * 100)}%`} />
          </div>

          <section className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Agency</th>
                  <th className="px-3 py-2">Score</th>
                  <th className="px-3 py-2 text-right">Workers</th>
                  <th className="px-3 py-2 text-right">Tickets</th>
                  <th className="px-3 py-2 text-right">Wage</th>
                  <th className="px-3 py-2 text-right">Safety</th>
                  <th className="px-3 py-2 text-right">Harassment</th>
                  <th className="px-3 py-2 text-right">Open</th>
                  <th className="px-3 py-2 text-right">Overdue</th>
                  <th className="px-3 py-2 text-right">Avg h</th>
                  <th className="px-3 py-2 text-right">Satisfied</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.contractors.map((c) => (
                  <tr key={c.contractorId}>
                    <td className="px-3 py-2">
                      <p className="font-medium">{c.agencyName}</p>
                      <p className="text-xs text-slate-500">{c.contractType}</p>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className={`grid size-7 place-items-center rounded-md text-xs font-bold ${GRADE_STYLE[c.grade]}`}>{c.grade}</span>
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-slate-800" style={{ width: `${c.score}%` }} />
                        </div>
                        <span className="tabular-nums">{c.score}</span>
                      </div>
                    </td>
                    {[c.workers, c.totalTickets, c.wageDisputes, c.safetyIssues, c.harassment, c.openTickets, c.overdueOpen].map((v, i) => (
                      <td key={i} className="px-3 py-2 text-right tabular-nums">
                        {v}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right tabular-nums">{c.avgResolutionHours ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{c.satisfactionRate === null ? "—" : `${Math.round(c.satisfactionRate * 100)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.unassigned > 0 && <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">{data.unassigned} ticket(s) are not linked to any agency.</p>}
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <h2 className="mb-3 font-semibold">Reports by category</h2>
              <ul className="space-y-2">
                {Object.entries(data.byCategory)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, n]) => (
                    <li key={cat} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-2 text-sm">
                      <span>{cat}</span>
                      <span className="h-3 overflow-hidden rounded-full bg-slate-100">
                        <span className="block h-full rounded-full bg-slate-700" style={{ width: `${(n / maxCat) * 100}%` }} />
                      </span>
                      <span className="text-right tabular-nums">{n}</span>
                    </li>
                  ))}
              </ul>
            </section>
            <section className="rounded-xl bg-white p-4 text-sm shadow-sm ring-1 ring-slate-200">
              <h2 className="mb-2 font-semibold">How the score is calculated</h2>
              <ul className="list-disc space-y-1 pl-5 text-slate-600">
                {data.formula.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-slate-500">Duplicate reports clustered into one master ticket count once.</p>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
