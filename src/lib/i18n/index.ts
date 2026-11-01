/**
 * Two display languages: Hindi (also used for the Bhojpuri / Garhwali / Kumaoni
 * dialects, which are written in Devanagari and only change the spoken output)
 * and English. Pure helpers, safe on server and client.
 */
import { GRIEVANCE_CATEGORIES, STATUS_EN, STATUS_HI } from "../constants";
import type { Dialect, GrievanceCategory, GrievanceStatus } from "../types";

export type Lang = "hi" | "en";

export const langOf = (dialect: Dialect | null | undefined): Lang => (dialect === "english" ? "en" : "hi");

/** Pick the string for a language: tr("hi", "नमस्ते", "Hello"). */
export const tr = (lang: Lang, hi: string, en: string): string => (lang === "en" ? en : hi);

export const hasDevanagari = (s: string): boolean => /[ऀ-ॿ]/.test(s);

/** Translate function from useLanguage(), or a plain language for server code. */
type Translate = Lang | ((hi: string, en: string) => string);
const pick = (by: Translate, hi: string, en: string) => (typeof by === "function" ? by(hi, en) : tr(by, hi, en));

export const categoryLabel = (c: GrievanceCategory, by: Translate) => pick(by, GRIEVANCE_CATEGORIES[c].labelHi, GRIEVANCE_CATEGORIES[c].labelEn);

export const statusLabel = (s: GrievanceStatus, by: Translate) => pick(by, STATUS_HI[s], STATUS_EN[s]);
