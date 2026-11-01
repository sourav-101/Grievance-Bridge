"use client";
import { FileSpreadsheet, FileText } from "lucide-react";
import { useState } from "react";

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86400_000).toISOString().slice(0, 10);

const REPORTS = [
  { type: "tickets", title: "Ticket log", desc: "Every grievance with category, location, agency, status, resolution time and English summary." },
  { type: "timeline", title: "Resolution timeline", desc: "Full audit trail: every status change, note and actor, per ticket." },
  { type: "contractors", title: "Contractor compliance", desc: "Agency scores, dispute counts, overdue tickets and satisfaction." },
];

/** One-click audit-ready exports (CSV / PDF). Worker identities are never exported. */
export default function ReportsPage() {
  const [from, setFrom] = useState(daysAgo(90));
  const [to, setTo] = useState(today());
  const href = (type: string, format: string) => `/api/admin/export?type=${type}&format=${format}&from=${from}&to=${to}`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Reports &amp; Export</h1>
        <p className="text-sm text-slate-500">Audit-ready records for university files. Exports use English summaries and exclude worker names and phone numbers.</p>
      </div>
      <div className="flex flex-wrap items-end gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <label className="text-sm">
          From
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="mt-1 block h-10 rounded-lg border border-slate-300 px-2" />
        </label>
        <label className="text-sm">
          To
          <input type="date" value={to} min={from} max={today()} onChange={(e) => setTo(e.target.value)} className="mt-1 block h-10 rounded-lg border border-slate-300 px-2" />
        </label>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {REPORTS.map((r) => (
          <section key={r.type} className="flex flex-col rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <h2 className="font-semibold">{r.title}</h2>
            <p className="mt-1 flex-1 text-sm text-slate-600">{r.desc}</p>
            <div className="mt-4 flex gap-2">
              <a href={href(r.type, "csv")} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white">
                <FileSpreadsheet className="size-4" aria-hidden /> CSV
              </a>
              <a href={href(r.type, "pdf")} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-semibold">
                <FileText className="size-4" aria-hidden /> PDF
              </a>
            </div>
          </section>
        ))}
      </div>
      <p className="text-xs text-slate-500">CSV keeps Hindi text (opens correctly in Excel). PDF uses English fields only.</p>
    </div>
  );
}
