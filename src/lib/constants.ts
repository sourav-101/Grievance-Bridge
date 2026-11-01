import type {
  Dialect,
  GrievanceCategory,
  GrievanceStatus,
  KnowledgeCategory,
  WorkType,
} from "./types";

// ----------------------------------------------------------------- Dialects
export const DIALECTS: Record<Dialect, { labelHi: string; labelEn: string; promptName: string }> = {
  hindi: { labelHi: "हिंदी", labelEn: "Hindi", promptName: "Standard Hindi" },
  english: { labelHi: "English", labelEn: "English", promptName: "simple Indian English" },
  bhojpuri: { labelHi: "भोजपुरी", labelEn: "Bhojpuri", promptName: "Bhojpuri" },
  garhwali: { labelHi: "गढ़वाली", labelEn: "Garhwali", promptName: "Garhwali (Uttarakhand)" },
  kumaoni: { labelHi: "कुमाऊँनी", labelEn: "Kumaoni", promptName: "Kumaoni (Uttarakhand)" },
};
export const DIALECT_IDS = Object.keys(DIALECTS) as Dialect[];

export const isDialect = (v: unknown): v is Dialect =>
  typeof v === "string" && (DIALECT_IDS as string[]).includes(v);
/**
 * Languages offered in the site for this prototype. The dialects stay defined
 * (database values, spoken rewriting) so they can be switched on later, but
 * until their on-screen text is translated and reviewed only these two are shown.
 */
export const SITE_LANGUAGES: Dialect[] = ["hindi", "english"];
export const isSiteLanguage = (v: unknown): v is Dialect => isDialect(v) && SITE_LANGUAGES.includes(v);

// ----------------------------------------------------------------- Work types
export const WORK_TYPES: Record<WorkType, { labelHi: string; labelEn: string; emoji: string }> = {
  Sanitation: { labelHi: "सफ़ाई", labelEn: "Sanitation", emoji: "🧹" },
  Horticulture: { labelHi: "बागवानी", labelEn: "Gardening", emoji: "🌳" },
  Construction: { labelHi: "निर्माण", labelEn: "Construction", emoji: "🏗️" },
  Security: { labelHi: "सुरक्षा", labelEn: "Security", emoji: "🛡️" },
  Maintenance: { labelHi: "रखरखाव", labelEn: "Maintenance", emoji: "🔧" },
};
export const WORK_TYPE_IDS = Object.keys(WORK_TYPES) as WorkType[];

// ----------------------------------------------------------------- Grievances
export const GRIEVANCE_CATEGORIES: Record<
  GrievanceCategory,
  { labelHi: string; labelEn: string; emoji: string; descriptionHi: string }
> = {
  "Wage Dispute": { labelHi: "वेतन / पैसा", labelEn: "Wages / Money", emoji: "💰", descriptionHi: "कम वेतन, देर से वेतन, पैसे काटना या रिश्वत" },
  "Safety/PPE": { labelHi: "सुरक्षा उपकरण", labelEn: "Safety Gear", emoji: "⛑️", descriptionHi: "हेलमेट, दस्ताने, जूते नहीं मिले, या खतरनाक काम" },
  Sanitation: { labelHi: "सफ़ाई / पानी", labelEn: "Sanitation / Water", emoji: "🚰", descriptionHi: "पानी, शौचालय, कचरा या गंदगी की समस्या" },
  Harassment: { labelHi: "उत्पीड़न", labelEn: "Harassment", emoji: "🚫", descriptionHi: "गाली, धमकी, मारपीट या छेड़छाड़" },
  General: { labelHi: "अन्य", labelEn: "Other", emoji: "📝", descriptionHi: "कोई और समस्या" },
};
export const GRIEVANCE_CATEGORY_IDS = Object.keys(GRIEVANCE_CATEGORIES) as GrievanceCategory[];
export const isGrievanceCategory = (v: unknown): v is GrievanceCategory =>
  typeof v === "string" && (GRIEVANCE_CATEGORY_IDS as string[]).includes(v);

export const STATUSES: GrievanceStatus[] = ["New", "Under Review", "In Progress", "Resolved"];
export const STATUS_HI: Record<GrievanceStatus, string> = {
  New: "नई शिकायत",
  "Under Review": "जांच हो रही है",
  "In Progress": "काम चल रहा है",
  Resolved: "हल हो गई",
};
export const STATUS_EN: Record<GrievanceStatus, string> = {
  New: "New complaint",
  "Under Review": "Under review",
  "In Progress": "Work in progress",
  Resolved: "Resolved",
};

// ----------------------------------------------------------------- Knowledge sections
export const KNOWLEDGE_CATEGORIES: KnowledgeCategory[] = [
  "Schemes",
  "Wage Rules",
  "Health Camps",
  "Campus Policies",
  "Document Checklist",
];
export const isKnowledgeCategory = (v: unknown): v is KnowledgeCategory =>
  typeof v === "string" && (KNOWLEDGE_CATEGORIES as string[]).includes(v);

/** Worker-facing section slugs → knowledge-base category. */
export const SECTIONS: Record<
  string,
  { category: KnowledgeCategory; titleHi: string; titleEn: string; emoji: string; introHi: string; introEn: string }
> = {
  schemes: {
    category: "Schemes",
    titleHi: "योजनाएं",
    titleEn: "Schemes",
    emoji: "📜",
    introHi: "केंद्र और उत्तराखंड सरकार की मज़दूरों के लिए योजनाएं।",
    introEn: "Central and Uttarakhand government schemes for workers.",
  },
  wages: {
    category: "Wage Rules",
    titleHi: "वेतन / हाज़िरी",
    titleEn: "Wages",
    emoji: "💰",
    introHi: "न्यूनतम वेतन और वेतन भुगतान की जानकारी।",
    introEn: "Minimum wages and salary payment rules.",
  },
  health: {
    category: "Health Camps",
    titleHi: "स्वास्थ्य शिविर",
    titleEn: "Health Camps",
    emoji: "🏥",
    introHi: "अस्पताल का समय और स्वास्थ्य शिविर की जानकारी।",
    introEn: "Hospital timings and health camps.",
  },
  rights: {
    category: "Campus Policies",
    titleHi: "आपके अधिकार",
    titleEn: "Your Rights",
    emoji: "⚖️",
    introHi: "कैंपस के नियम, सुरक्षा और गुमनाम शिकायत।",
    introEn: "Campus rules, safety and anonymous complaints.",
  },
  checklist: {
    category: "Document Checklist",
    titleHi: "ज़रूरी कागज़",
    titleEn: "Document Checklist",
    emoji: "🗂️",
    introHi: "सरकारी योजनाओं के लिए कौन से कागज़ लेकर जाएं।",
    introEn: "Which documents to carry for government schemes.",
  },
};

// ----------------------------------------------------------------- Limits
/** Sarvam's synchronous STT accepts up to 30 s of audio. */
export const MAX_RECORDING_SECONDS = 30;
export const FEEDBACK_RECORDING_SECONDS = 10;
export const MAX_AUDIO_UPLOAD_BYTES = 4 * 1024 * 1024; // stays under Vercel's 4.5 MB body limit
export const DUPLICATE_WINDOW_DAYS = 7;
