import type { GrievanceCategory, GrievanceStatus } from "@/lib/types";

/** Mirrors AdminTicketCard from src/lib/admin/tickets.ts (client copy, no server imports). */
export interface TicketCard {
  id: string;
  ticketNumber: number;
  token: string;
  category: GrievanceCategory;
  location: string;
  zoneId: string | null;
  status: GrievanceStatus;
  isEmergency: boolean;
  emergencyKeywords: string[];
  isAnonymous: boolean;
  summaryEnglish: string;
  transcriptHindi: string;
  source: "voice" | "tap";
  dialect: string;
  parentTicketId: string | null;
  duplicateCount: number;
  contractorId: string | null;
  contractorName: string | null;
  assignedDepartment: string;
  resolutionNoteHindi: string | null;
  hasAudio: boolean;
  hasPhoto: boolean;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  worker: { name: string; phone: string; workType: string | null } | null;
}

export const CATEGORY_STYLE: Record<GrievanceCategory, string> = {
  "Wage Dispute": "bg-emerald-100 text-emerald-800",
  "Safety/PPE": "bg-amber-100 text-amber-800",
  Sanitation: "bg-sky-100 text-sky-800",
  Harassment: "bg-fuchsia-100 text-fuchsia-800",
  General: "bg-slate-200 text-slate-700",
};

export const STATUS_COLUMN_STYLE: Record<GrievanceStatus, string> = {
  New: "border-t-blue-600",
  "Under Review": "border-t-amber-500",
  "In Progress": "border-t-cyan-600",
  Resolved: "border-t-emerald-600",
};

export function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
