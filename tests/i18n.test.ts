import { describe, expect, it } from "vitest";
import { ruleBasedAnswer, sanitizeActions } from "@/lib/ai/assistant-rules";
import { DIALECT_IDS } from "@/lib/constants";
import { categoryLabel, hasDevanagari, langOf, statusLabel } from "@/lib/i18n";
import { PUBLIC_PROMPTS, PUBLIC_PROMPTS_EN, SPOKEN, SPOKEN_EN, publicPrompt, spokenFor } from "@/lib/i18n/prompts";
import { receiptSpeechEn, statusSpeech } from "@/lib/grievances/ticket-speech";

describe("English language option", () => {
  it("is offered alongside Hindi and the dialects", () => {
    expect(DIALECT_IDS).toContain("english");
    expect(langOf("english")).toBe("en");
    expect(langOf("garhwali")).toBe("hi");
  });

  it("has an English version of every fixed prompt, with no Devanagari", () => {
    for (const key of Object.keys(PUBLIC_PROMPTS) as (keyof typeof PUBLIC_PROMPTS)[]) {
      expect(hasDevanagari(PUBLIC_PROMPTS_EN[key])).toBe(false);
      expect(publicPrompt(key, true)).toBe(PUBLIC_PROMPTS_EN[key]);
      expect(publicPrompt(key, false)).toBe(PUBLIC_PROMPTS[key]);
    }
    expect(spokenFor("english")).toBe(SPOKEN_EN);
    expect(spokenFor("bhojpuri")).toBe(SPOKEN);
    expect(hasDevanagari(SPOKEN_EN.greeting("Ramesh"))).toBe(false);
  });

  it("labels categories, statuses and spoken receipts in English", () => {
    expect(categoryLabel("Sanitation", "en")).toBe("Sanitation / Water");
    expect(statusLabel("In Progress", "en")).toBe("Work in progress");
    const view = { token: "4821", category: "Sanitation" as const, location: "गोविंद भवन", locationEn: "Govind Bhawan", status: "New" as const, resolutionNoteHindi: null };
    expect(statusSpeech(view, true)).toContain("Govind Bhawan");
    expect(hasDevanagari(statusSpeech(view, true))).toBe(false);
    expect(hasDevanagari(receiptSpeechEn("4821", "Sanitation / Water", "Govind Bhawan", true, false))).toBe(false);
  });

  it("help assistant answers and links in English", () => {
    const r = ruleBasedAnswer("how do I complain about water?", "en");
    expect(hasDevanagari(r.reply)).toBe(false);
    expect(r.actions).toEqual([{ href: "/grievance", label: "File a complaint" }]);
    expect(sanitizeActions(["/status"], "en")).toEqual([{ href: "/status", label: "Check status by token" }]);
  });
});
