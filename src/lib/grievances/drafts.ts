import type { Dialect, GrievanceCategory } from "../types";

/**
 * A voice grievance is first returned to the worker as a signed draft so they
 * can confirm it, correct category/location, and choose anonymity before it is
 * filed. The server re-verifies the signature and worker id on submission.
 */
export interface GrievanceDraftPayload {
  wid: string;
  audioPath: string;
  transcript: string;
  rawTranscript: string;
  category: GrievanceCategory;
  zoneId: string | null;
  locationText: string;
  summaryEnglish: string;
  isEmergency: boolean;
  emergencyKeywords: string[];
  dialect: Dialect;
}
