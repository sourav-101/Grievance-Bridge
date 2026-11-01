import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-auth";
import { loadAnalyticsData } from "@/lib/admin/analytics-data";
import { SCORE_FORMULA, computeContractorScores, summarize } from "@/lib/admin/analytics";
import { handleRouteError } from "@/lib/http";

/** Contractor compliance analytics. ?days=90 limits the window (default: all time). */
export async function GET(req: Request) {
  try {
    const auth = await requireAdmin("analytics.view");
    if (auth instanceof NextResponse) return auth;
    const days = Number(new URL(req.url).searchParams.get("days")) || 0;
    const since = days > 0 ? new Date(Date.now() - days * 86400_000).toISOString() : undefined;
    const { grievances, feedback, contractors, workerCounts } = await loadAnalyticsData(since);
    const ids = new Set(grievances.map((g) => g.id));
    const fb = feedback.filter((f) => ids.has(f.grievance_id));

    const byCategory: Record<string, number> = {};
    for (const g of grievances) byCategory[g.category] = (byCategory[g.category] ?? 0) + 1;

    return NextResponse.json({
      summary: summarize(grievances, fb),
      byCategory,
      contractors: computeContractorScores(contractors, grievances, fb, workerCounts),
      unassigned: grievances.filter((g) => !g.contractor_id && !g.parent_ticket_id).length,
      formula: SCORE_FORMULA,
    });
  } catch (err) {
    return handleRouteError(err, "admin:analytics");
  }
}
