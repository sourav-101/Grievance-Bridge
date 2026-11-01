import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-auth";
import { loadAnalyticsData } from "@/lib/admin/analytics-data";
import { aggregateByZone } from "@/lib/admin/analytics";
import { CAMPUS_CENTER } from "@/lib/campus";
import { isGrievanceCategory } from "@/lib/constants";
import { handleRouteError } from "@/lib/http";

/** Per-zone grievance counts for the campus heatmap. ?days=30&category=Sanitation&openOnly=1 */
export async function GET(req: Request) {
  try {
    const auth = await requireAdmin("heatmap.view");
    if (auth instanceof NextResponse) return auth;
    const url = new URL(req.url);
    const days = Number(url.searchParams.get("days")) || 30;
    const category = url.searchParams.get("category");
    const openOnly = url.searchParams.get("openOnly") === "1";

    const { grievances } = await loadAnalyticsData(new Date(Date.now() - days * 86400_000).toISOString());
    const filtered = grievances.filter(
      (g) => (!isGrievanceCategory(category) || g.category === category) && (!openOnly || g.status !== "Resolved"),
    );
    return NextResponse.json({ center: CAMPUS_CENTER, zones: aggregateByZone(filtered), total: filtered.length });
  } catch (err) {
    return handleRouteError(err, "admin:heatmap");
  }
}
