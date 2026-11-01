import "server-only";
import type { AnalyticsFeedback, AnalyticsGrievance } from "./analytics";
import { supabaseAdmin } from "../supabase/admin";
import { fetchAllRows } from "../supabase/paginate";

/** Pull the slim columns analytics needs (no transcripts / identities). */
export async function loadAnalyticsData(sinceIso?: string) {
  const db = supabaseAdmin();
  const [grievances, feedback, { data: contractors, error: cErr }, workers] = await Promise.all([
    fetchAllRows<AnalyticsGrievance>((from, to) => {
      let q = db
        .from("grievances")
        .select("id, contractor_id, category, status, is_emergency, parent_ticket_id, campus_zone, created_at, resolved_at")
        .order("created_at", { ascending: false })
        .order("id");
      if (sinceIso) q = q.gte("created_at", sinceIso);
      return q.range(from, to);
    }),
    fetchAllRows<AnalyticsFeedback>((from, to) => db.from("feedback").select("grievance_id, rating").order("id").range(from, to)),
    db.from("contractors").select("id, agency_name, contract_type, is_active").order("agency_name"),
    fetchAllRows<{ contractor_id: string | null }>((from, to) =>
      db.from("workers").select("contractor_id").order("id").range(from, to),
    ),
  ]);
  if (cErr) throw new Error(cErr.message);
  const workerCounts: Record<string, number> = {};
  for (const w of workers) {
    if (w.contractor_id) workerCounts[w.contractor_id] = (workerCounts[w.contractor_id] ?? 0) + 1;
  }
  return {
    grievances,
    feedback,
    contractors: (contractors ?? []) as { id: string; agency_name: string; contract_type: string; is_active: boolean }[],
    workerCounts,
  };
}
