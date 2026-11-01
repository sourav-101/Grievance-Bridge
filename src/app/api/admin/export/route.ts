import { NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { requireAdmin } from "@/lib/auth/admin-auth";
import { loadAnalyticsData } from "@/lib/admin/analytics-data";
import { computeContractorScores } from "@/lib/admin/analytics";
import { toCsv } from "@/lib/admin/csv";
import { handleRouteError, jsonError } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/supabase/paginate";

export const runtime = "nodejs";
export const maxDuration = 60;

type Table = { title: string; headers: string[]; rows: (string | number | null)[][] };

const hours = (a: string, b: string | null) =>
  b ? Math.round(((new Date(b).getTime() - new Date(a).getTime()) / 3600_000) * 10) / 10 : null;
const fmt = (d: string | null) => (d ? new Date(d).toISOString().replace("T", " ").slice(0, 16) + " UTC" : "");

/**
 * Audit-ready export. Records use the English summaries (official records) and
 * never include worker names or phone numbers.
 *   /api/admin/export?type=tickets|timeline|contractors&format=csv|pdf&from=2026-01-01&to=2026-12-31
 */
export async function GET(req: Request) {
  try {
    const auth = await requireAdmin("reports.export");
    if (auth instanceof NextResponse) return auth;
    const url = new URL(req.url);
    const type = url.searchParams.get("type") || "tickets";
    const format = url.searchParams.get("format") || "csv";
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (!["tickets", "timeline", "contractors"].includes(type) || !["csv", "pdf"].includes(format)) {
      return jsonError("Invalid export type/format");
    }
    const fromIso = from ? new Date(`${from}T00:00:00Z`).toISOString() : new Date(Date.now() - 90 * 86400_000).toISOString();
    const toIso = to ? new Date(`${to}T23:59:59Z`).toISOString() : new Date().toISOString();

    let table: Table;
    const db = supabaseAdmin();

    if (type === "tickets" || type === "timeline") {
      // Paged: an audit export must never be silently cut at Supabase's 1000-row cap.
      const rows = await fetchAllRows<{
        id: string; ticket_number: number; ticket_token: string; category: string; campus_location: string; status: string;
        is_emergency: boolean; is_anonymous: boolean; parent_ticket_id: string | null; assigned_department: string;
        summary_english: string; source: string; created_at: string; resolved_at: string | null; photo_url?: string | null;
        contractors: { agency_name: string } | null;
      }>((from, to) =>
        db
          .from("grievances")
          // "*" rather than a column list so exports still work before migration 0004 (photo_url) is run.
          .select("*, contractors(agency_name)")
          .gte("created_at", fromIso)
          .lte("created_at", toIso)
          .order("created_at")
          .order("id")
          .range(from, to),
      );
      const numberById = new Map(rows.map((r) => [r.id, r.ticket_number]));

      if (type === "tickets") {
        table = {
          title: "Grievance Ticket Log",
          headers: ["No.", "Token", "Filed", "Category", "Location", "Agency", "Status", "Resolved", "Hours to resolve", "Emergency", "Anonymous", "Duplicate of", "Department", "Source", "Photo", "Summary (English)"],
          rows: rows.map((r) => [
            r.ticket_number, r.ticket_token, fmt(r.created_at), r.category, r.campus_location, r.contractors?.agency_name ?? "",
            r.status, fmt(r.resolved_at), hours(r.created_at, r.resolved_at), r.is_emergency ? "Yes" : "No", r.is_anonymous ? "Yes" : "No",
            r.parent_ticket_id ? `#${numberById.get(r.parent_ticket_id) ?? "?"}` : "", r.assigned_department, r.source, r.photo_url ? "Yes" : "No", r.summary_english,
          ]),
        };
      } else {
        const ids = rows.map((r) => r.id);
        const events: { grievance_id: string; created_at: string; actor_label: string; from_status: string | null; to_status: string | null; note: string | null }[] = [];
        for (let i = 0; i < ids.length; i += 200) {
          const chunk = ids.slice(i, i + 200);
          const ev = await fetchAllRows<(typeof events)[number]>((from, to) =>
            db
              .from("grievance_events")
              .select("grievance_id, created_at, actor_label, from_status, to_status, note")
              .in("grievance_id", chunk)
              .order("created_at")
              .order("id")
              .range(from, to),
          );
          events.push(...ev);
        }
        events.sort((a, b) => a.created_at.localeCompare(b.created_at));
        table = {
          title: "Resolution Timeline (Audit Trail)",
          headers: ["Ticket No.", "When", "Actor", "From", "To", "Note"],
          rows: events.map((e) => [numberById.get(e.grievance_id) ?? "", fmt(e.created_at), e.actor_label, e.from_status ?? "", e.to_status ?? "", e.note ?? ""]),
        };
      }
    } else {
      const { grievances, feedback, contractors, workerCounts } = await loadAnalyticsData(fromIso);
      const inRange = grievances.filter((g) => g.created_at <= toIso);
      const scores = computeContractorScores(contractors, inRange, feedback, workerCounts);
      table = {
        title: "Contractor Compliance Report",
        headers: ["Agency", "Type", "Workers", "Tickets", "Wage disputes", "Safety", "Harassment", "Open", "Overdue (>7d)", "Avg hours to resolve", "Satisfaction", "Score", "Grade"],
        rows: scores.map((s) => [
          s.agencyName, s.contractType, s.workers, s.totalTickets, s.wageDisputes, s.safetyIssues, s.harassment, s.openTickets, s.overdueOpen,
          s.avgResolutionHours, s.satisfactionRate === null ? "" : `${Math.round(s.satisfactionRate * 100)}%`, s.score, s.grade,
        ]),
      };
    }

    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `iitr-${type}-${stamp}.${format}`;
    if (format === "csv") {
      return new NextResponse(toCsv(table.headers, table.rows), {
        headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"` },
      });
    }

    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFontSize(14);
    doc.text(`IIT Roorkee — ${table.title}`, 40, 40);
    doc.setFontSize(9);
    doc.text(
      `Period: ${fromIso.slice(0, 10)} to ${toIso.slice(0, 10)}   ·   Generated: ${fmt(new Date().toISOString())} by ${auth.admin.full_name}   ·   Worker identities are excluded.`,
      40,
      58,
    );
    autoTable(doc, {
      startY: 72,
      head: [table.headers],
      // jsPDF core fonts cannot render Devanagari; strip non-Latin characters in the PDF (CSV keeps them).
      body: table.rows.map((r) => r.map((c) => (c === null ? "" : String(c).replace(/[^\x20-\x7E]/g, "")))),
      styles: { fontSize: 7, cellPadding: 3, overflow: "linebreak" },
      headStyles: { fillColor: [17, 24, 39] },
      margin: { left: 40, right: 40 },
    });
    const pdf = doc.output("arraybuffer");
    return new NextResponse(pdf, {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"` },
    });
  } catch (err) {
    return handleRouteError(err, "admin:export");
  }
}
