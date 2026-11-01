import { z } from "zod";
import { KNOWLEDGE_CATEGORIES, WORK_TYPE_IDS } from "../constants";
import type { KnowledgeCategory, WorkType } from "../types";

// (Route files may only export handlers, so shared zod schemas live here.)

export const KnowledgeBody = z.object({
  title: z.string().trim().min(2).max(200),
  category: z.enum(KNOWLEDGE_CATEGORIES as [KnowledgeCategory, ...KnowledgeCategory[]]),
  contentHindi: z.string().trim().min(5).max(5000),
  isPublished: z.boolean().default(true),
  isPlaceholder: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(10000).default(100),
});

export const HelplineBody = z.object({
  kind: z.enum(["security", "medical", "women", "other"]),
  nameHindi: z.string().trim().min(2).max(100),
  nameEnglish: z.string().trim().min(2).max(100),
  phone: z.string().trim().regex(/^[0-9+\- ]{3,20}$/, "digits only"),
  instructionsHindi: z.string().trim().min(5).max(1000),
  isPlaceholder: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(10000).default(100),
});

export const ContractorBody = z.object({
  agencyName: z.string().trim().min(2).max(150),
  contractType: z.enum(WORK_TYPE_IDS as [WorkType, ...WorkType[]]),
  supervisorName: z.string().trim().max(100).nullable().default(null),
  contactPhone: z.string().trim().regex(/^[0-9+\- ]{3,15}$/, "digits only"),
  isActive: z.boolean().default(true),
});
