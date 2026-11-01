/** Pure analytics (unit tested). */
import { CAMPUS_ZONES } from "../campus";
import type { GrievanceCategory, GrievanceStatus } from "../types";

export interface AnalyticsGrievance {
  id: string;
  contractor_id: string | null;
  category: GrievanceCategory;
  status: GrievanceStatus;
  is_emergency: boolean;
  parent_ticket_id: string | null;
  campus_zone: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface AnalyticsFeedback {
  grievance_id: string;
  rating: "Satisfied" | "Unsatisfied";
}

export interface ContractorScore {
  contractorId: string;
  agencyName: string;
  contractType: string;
  workers: number;
  totalTickets: number;
  wageDisputes: number;
  safetyIssues: number;
  harassment: number;
  openTickets: number;
  overdueOpen: number;
  resolvedTickets: number;
  avgResolutionHours: number | null;
  satisfactionRate: number | null;
  score: number;
  grade: "A" | "B" | "C" | "D";
}

export const SCORE_FORMULA = [
  "Start at 100",
  "−6 per wage dispute, −4 per safety/PPE complaint, −8 per harassment complaint",
  "−3 per open ticket older than 7 days",
  "−2 per day the average resolution time exceeds 3 days (max −20)",
  "−20 × share of 'Unsatisfied' feedback",
  "Clamped to 0–100. Grades: A ≥ 85, B ≥ 70, C ≥ 50, D below.",
];

const HOUR = 3600_000;

export function computeContractorScores(
  contractors: { id: string; agency_name: string; contract_type: string }[],
  grievances: AnalyticsGrievance[],
  feedback: AnalyticsFeedback[],
  workerCounts: Record<string, number> = {},
  now: Date = new Date(),
): ContractorScore[] {
  const ratingByTicket = new Map(feedback.map((f) => [f.grievance_id, f.rating]));
  // Count master tickets only, so one burst of duplicate reports isn't penalised many times.
  const masters = grievances.filter((g) => !g.parent_ticket_id);

  return contractors
    .map((c) => {
      const mine = masters.filter((g) => g.contractor_id === c.id);
      const resolved = mine.filter((g) => g.status === "Resolved" && g.resolved_at);
      const open = mine.filter((g) => g.status !== "Resolved");
      const overdueOpen = open.filter((g) => now.getTime() - new Date(g.created_at).getTime() > 7 * 24 * HOUR).length;
      const avgResolutionHours = resolved.length
        ? resolved.reduce((s, g) => s + (new Date(g.resolved_at as string).getTime() - new Date(g.created_at).getTime()) / HOUR, 0) /
          resolved.length
        : null;
      const ratings = mine.map((g) => ratingByTicket.get(g.id)).filter(Boolean);
      const satisfied = ratings.filter((r) => r === "Satisfied").length;
      const satisfactionRate = ratings.length ? satisfied / ratings.length : null;

      const wageDisputes = mine.filter((g) => g.category === "Wage Dispute").length;
      const safetyIssues = mine.filter((g) => g.category === "Safety/PPE").length;
      const harassment = mine.filter((g) => g.category === "Harassment").length;

      let score = 100;
      score -= wageDisputes * 6 + safetyIssues * 4 + harassment * 8;
      score -= overdueOpen * 3;
      if (avgResolutionHours !== null && avgResolutionHours > 72) {
        score -= Math.min(20, ((avgResolutionHours - 72) / 24) * 2);
      }
      if (satisfactionRate !== null) score -= (1 - satisfactionRate) * 20;
      score = Math.max(0, Math.min(100, Math.round(score)));

      return {
        contractorId: c.id,
        agencyName: c.agency_name,
        contractType: c.contract_type,
        workers: workerCounts[c.id] ?? 0,
        totalTickets: mine.length,
        wageDisputes,
        safetyIssues,
        harassment,
        openTickets: open.length,
        overdueOpen,
        resolvedTickets: resolved.length,
        avgResolutionHours: avgResolutionHours === null ? null : Math.round(avgResolutionHours * 10) / 10,
        satisfactionRate: satisfactionRate === null ? null : Math.round(satisfactionRate * 100) / 100,
        score,
        grade: (score >= 85 ? "A" : score >= 70 ? "B" : score >= 50 ? "C" : "D") as ContractorScore["grade"],
      };
    })
    .sort((a, b) => a.score - b.score || b.totalTickets - a.totalTickets);
}

export interface ZoneAggregate {
  zoneId: string;
  nameEn: string;
  nameHi: string;
  lat: number;
  lng: number;
  total: number;
  open: number;
  emergencies: number;
  byCategory: Partial<Record<GrievanceCategory, number>>;
}

/** Heatmap aggregation — counts ALL reports (including clustered duplicates) per zone. */
export function aggregateByZone(grievances: AnalyticsGrievance[]): ZoneAggregate[] {
  const byZone = new Map<string, ZoneAggregate>();
  for (const z of CAMPUS_ZONES) {
    byZone.set(z.id, { zoneId: z.id, nameEn: z.nameEn, nameHi: z.nameHi, lat: z.lat, lng: z.lng, total: 0, open: 0, emergencies: 0, byCategory: {} });
  }
  for (const g of grievances) {
    const agg = byZone.get(g.campus_zone ?? "other") ?? byZone.get("other")!;
    agg.total += 1;
    if (g.status !== "Resolved") agg.open += 1;
    if (g.is_emergency) agg.emergencies += 1;
    agg.byCategory[g.category] = (agg.byCategory[g.category] ?? 0) + 1;
  }
  return [...byZone.values()].filter((z) => z.total > 0).sort((a, b) => b.total - a.total);
}

export function summarize(grievances: AnalyticsGrievance[], feedback: AnalyticsFeedback[]) {
  const masters = grievances.filter((g) => !g.parent_ticket_id);
  const resolved = masters.filter((g) => g.status === "Resolved" && g.resolved_at);
  const avg = resolved.length
    ? resolved.reduce((s, g) => s + (new Date(g.resolved_at as string).getTime() - new Date(g.created_at).getTime()) / HOUR, 0) / resolved.length
    : null;
  const sat = feedback.filter((f) => f.rating === "Satisfied").length;
  return {
    totalReports: grievances.length,
    masterTickets: masters.length,
    openTickets: masters.filter((g) => g.status !== "Resolved").length,
    openEmergencies: masters.filter((g) => g.is_emergency && g.status !== "Resolved").length,
    avgResolutionHours: avg === null ? null : Math.round(avg * 10) / 10,
    satisfactionRate: feedback.length ? Math.round((sat / feedback.length) * 100) / 100 : null,
  };
}
