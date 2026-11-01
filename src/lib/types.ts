export type Dialect = "hindi" | "english" | "bhojpuri" | "garhwali" | "kumaoni";

export type WorkType = "Sanitation" | "Security" | "Horticulture" | "Construction" | "Maintenance";

export type GrievanceCategory = "Wage Dispute" | "Safety/PPE" | "Sanitation" | "Harassment" | "General";

export type GrievanceStatus = "New" | "Under Review" | "In Progress" | "Resolved";

export type KnowledgeCategory =
  | "Schemes"
  | "Wage Rules"
  | "Health Camps"
  | "Campus Policies"
  | "Document Checklist";

export type AdminRole = "dean" | "estate_officer" | "contractor";

export interface Worker {
  id: string;
  phone_number: string;
  full_name: string;
  age: number | null;
  is_phone_verified: boolean;
  preferred_dialect: Dialect;
  work_type: WorkType | null;
  contractor_id: string | null;
  created_at: string;
}

export interface Contractor {
  id: string;
  agency_name: string;
  contract_type: WorkType;
  supervisor_name: string | null;
  contact_phone: string;
  is_active: boolean;
  created_at: string;
}

export interface Grievance {
  id: string;
  ticket_number: number;
  ticket_token: string;
  worker_id: string | null;
  contractor_id: string | null;
  category: GrievanceCategory;
  campus_location: string;
  campus_zone: string | null;
  latitude: number | null;
  longitude: number | null;
  raw_audio_url: string | null;
  /** Storage path of an optional photo of the problem (private photo vault). */
  photo_url?: string | null;
  transcript_hindi: string;
  summary_english: string;
  is_anonymous: boolean;
  is_emergency: boolean;
  emergency_keywords: string[];
  parent_ticket_id: string | null;
  status: GrievanceStatus;
  assigned_department: string;
  resolution_note_hindi: string | null;
  resolved_at: string | null;
  dialect: Dialect;
  source: "voice" | "tap";
  created_at: string;
  updated_at: string;
}

export interface Feedback {
  id: string;
  grievance_id: string;
  worker_id: string | null;
  rating: "Satisfied" | "Unsatisfied";
  feedback_audio_url: string | null;
  feedback_transcript: string | null;
  created_at: string;
}

export interface KnowledgeItem {
  id: string;
  title: string;
  /** English copy (migration 0005); null until translated. */
  title_english?: string | null;
  content_english?: string | null;
  category: KnowledgeCategory;
  content_hindi: string;
  is_published: boolean;
  is_placeholder: boolean;
  sort_order: number;
  updated_at: string;
  has_embedding?: boolean;
}

export interface Helpline {
  id: string;
  /** English copy of instructions_hindi (migration 0005); null until translated. */
  instructions_english?: string | null;
  kind: "security" | "medical" | "women" | "other";
  name_hindi: string;
  name_english: string;
  phone: string;
  instructions_hindi: string;
  is_placeholder: boolean;
  sort_order: number;
}

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: AdminRole;
  contractor_id: string | null;
  is_active: boolean;
  created_at: string;
}

export interface GrievanceEvent {
  id: string;
  grievance_id: string;
  actor_admin_id: string | null;
  actor_label: string;
  from_status: GrievanceStatus | null;
  to_status: GrievanceStatus | null;
  note: string | null;
  created_at: string;
}

/** Speech payload returned by the server for playback. */
export interface SpeechPayload {
  /** The exact text that was spoken (after dialect adaptation / translation). */
  text: string;
  /** Base64 audio chunks to play in order; null => fetch the voice (deferred) or use the device voice. */
  audios: string[] | null;
  mime: string;
  /** Text only: the browser fetches the voice from /api/tts, so the answer shows ~3 s sooner. */
  deferred?: boolean;
}

/** Ticket view a worker is allowed to see. */
export interface WorkerTicketView {
  id: string;
  token: string;
  category: GrievanceCategory;
  location: string;
  /** English place name (same as `location` when the place is not a known campus zone). */
  locationEn: string;
  status: GrievanceStatus;
  isAnonymous: boolean;
  isEmergency: boolean;
  summaryHindi: string;
  resolutionNoteHindi: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  feedbackGiven: boolean;
  hasPhoto: boolean;
}
