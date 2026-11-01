import "server-only";
import { can } from "../auth/rbac";
import type { AdminUser, Grievance } from "../types";

export interface AdminTicketCard {
  id: string;
  ticketNumber: number;
  token: string;
  category: Grievance["category"];
  location: string;
  zoneId: string | null;
  status: Grievance["status"];
  isEmergency: boolean;
  emergencyKeywords: string[];
  isAnonymous: boolean;
  summaryEnglish: string;
  transcriptHindi: string;
  source: Grievance["source"];
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
  /** Only for dean / estate officer, and never for anonymous tickets. */
  worker: { name: string; phone: string; workType: string | null } | null;
}

type Row = Grievance & {
  workers?: { full_name: string; phone_number: string; work_type: string | null } | null;
  contractors?: { agency_name: string } | null;
};

export const ADMIN_TICKET_SELECT =
  "*, workers(full_name, phone_number, work_type), contractors(agency_name)";

export function toAdminCard(row: Row, admin: AdminUser, duplicateCount = 0): AdminTicketCard {
  const showIdentity = can(admin.role, "tickets.viewIdentity") && !row.is_anonymous && row.workers;
  return {
    id: row.id,
    ticketNumber: row.ticket_number,
    token: row.ticket_token,
    category: row.category,
    location: row.campus_location,
    zoneId: row.campus_zone,
    status: row.status,
    isEmergency: row.is_emergency,
    emergencyKeywords: row.emergency_keywords ?? [],
    isAnonymous: row.is_anonymous,
    summaryEnglish: row.summary_english,
    transcriptHindi: row.transcript_hindi,
    source: row.source,
    dialect: row.dialect,
    parentTicketId: row.parent_ticket_id,
    duplicateCount,
    contractorId: row.contractor_id,
    contractorName: row.contractors?.agency_name ?? null,
    assignedDepartment: row.assigned_department,
    resolutionNoteHindi: row.resolution_note_hindi,
    hasAudio: Boolean(row.raw_audio_url),
    hasPhoto: Boolean(row.photo_url),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
    worker: showIdentity
      ? { name: row.workers!.full_name, phone: row.workers!.phone_number, workType: row.workers!.work_type }
      : null,
  };
}

/** Is this ticket inside the admin's scope? (contractors: own agency, non-anonymous) */
export function inScope(row: Pick<Grievance, "contractor_id" | "is_anonymous">, admin: AdminUser): boolean {
  if (admin.role === "contractor") return row.contractor_id === admin.contractor_id && !row.is_anonymous;
  return true;
}
