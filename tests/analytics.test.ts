import { describe, expect, it } from "vitest";
import { aggregateByZone, computeContractorScores, summarize, type AnalyticsGrievance } from "@/lib/admin/analytics";

const NOW = new Date("2026-10-14T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86400_000).toISOString();

function g(p: Partial<AnalyticsGrievance>): AnalyticsGrievance {
  return {
    id: Math.random().toString(36).slice(2),
    contractor_id: "A",
    category: "General",
    status: "New",
    is_emergency: false,
    parent_ticket_id: null,
    campus_zone: "govind",
    created_at: daysAgo(1),
    resolved_at: null,
    ...p,
  };
}

const contractors = [
  { id: "A", agency_name: "Agency A", contract_type: "Sanitation" },
  { id: "B", agency_name: "Agency B", contract_type: "Security" },
];

describe("contractor compliance scoring", () => {
  it("gives a clean agency 100 / A", () => {
    const [b] = computeContractorScores(contractors, [], [], {}, NOW).filter((s) => s.contractorId === "B");
    expect(b.score).toBe(100);
    expect(b.grade).toBe("A");
  });

  it("penalises disputes, overdue tickets, slow resolution and dissatisfaction", () => {
    const resolved = g({ id: "r1", category: "Wage Dispute", status: "Resolved", created_at: daysAgo(10), resolved_at: daysAgo(3) });
    const tickets = [
      resolved,
      g({ category: "Harassment" }),
      g({ category: "Safety/PPE", created_at: daysAgo(9) }), // overdue
    ];
    const [a] = computeContractorScores(contractors, tickets, [{ grievance_id: "r1", rating: "Unsatisfied" }], { A: 12 }, NOW);
    // 100 − 6 (wage) − 8 (harassment) − 4 (safety) − 3 (overdue) − 2*(168−72)/24=8 − 20 (unsatisfied) = 51
    expect(a.contractorId).toBe("A");
    expect(a.score).toBe(51);
    expect(a.grade).toBe("C");
    expect(a.workers).toBe(12);
    expect(a.avgResolutionHours).toBe(168);
    expect(a.overdueOpen).toBe(1);
  });

  it("counts clustered duplicates once", () => {
    const master = g({ id: "m", category: "Wage Dispute" });
    const dup = g({ category: "Wage Dispute", parent_ticket_id: "m" });
    const [a] = computeContractorScores(contractors, [master, dup], [], {}, NOW);
    expect(a.totalTickets).toBe(1);
    expect(a.score).toBe(94);
  });

  it("sorts worst agencies first", () => {
    const scores = computeContractorScores(contractors, [g({ category: "Harassment" })], [], {}, NOW);
    expect(scores[0].contractorId).toBe("A");
  });
});

describe("heatmap aggregation", () => {
  it("groups by zone, counts duplicates and open/emergency", () => {
    const zones = aggregateByZone([
      g({ campus_zone: "govind" }),
      g({ campus_zone: "govind", parent_ticket_id: "x", is_emergency: true }),
      g({ campus_zone: "mac", status: "Resolved" }),
      g({ campus_zone: null }),
    ]);
    expect(zones[0].zoneId).toBe("govind");
    expect(zones[0].total).toBe(2);
    expect(zones[0].emergencies).toBe(1);
    expect(zones.find((z) => z.zoneId === "mac")?.open).toBe(0);
    expect(zones.find((z) => z.zoneId === "other")?.total).toBe(1);
  });

  it("summarises", () => {
    const s = summarize([g({ is_emergency: true }), g({ status: "Resolved", created_at: daysAgo(2), resolved_at: daysAgo(1) })], [{ grievance_id: "z", rating: "Satisfied" }]);
    expect(s.openEmergencies).toBe(1);
    expect(s.avgResolutionHours).toBe(24);
    expect(s.satisfactionRate).toBe(1);
  });
});
