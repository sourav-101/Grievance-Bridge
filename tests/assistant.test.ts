import { describe, expect, it } from "vitest";
import { ALLOWED_ACTIONS, ruleBasedAnswer, sanitizeActions } from "@/lib/ai/assistant-rules";

describe("help assistant fallback", () => {
  it("routes common questions to the right page", () => {
    expect(ruleBasedAnswer("शिकायत कैसे करें?").actions[0].href).toBe("/grievance");
    expect(ruleBasedAnswer("मेरी शिकायत का टोकन").actions[0].href).toBe("/status");
    expect(ruleBasedAnswer("PIN भूल गया").actions[0].href).toBe("/login");
    expect(ruleBasedAnswer("अस्पताल कब खुलता है").actions[0].href).toBe("/section/health");
    expect(ruleBasedAnswer("ई-श्रम योजना").actions[0].href).toBe("/section/schemes");
  });
  it("puts emergencies first", () => {
    expect(ruleBasedAnswer("करंट लगा है, चोट आई").actions[0].href).toBe("#emergency");
  });
  it("always answers something", () => {
    const r = ruleBasedAnswer("xyz");
    expect(r.reply.length).toBeGreaterThan(10);
  });
});

describe("assistant link allow-list", () => {
  it("drops unknown links, dedupes, relabels and caps at 3", () => {
    const out = sanitizeActions(["/grievance", { href: "https://evil.example" }, "/grievance", { href: "/status", label: "x" }, "/history", "/section/wages"]);
    expect(out.map((a) => a.href)).toEqual(["/grievance", "/status", "/history"]);
    expect(out[1].label).toBe(ALLOWED_ACTIONS["/status"]);
    expect(sanitizeActions("nope")).toEqual([]);
  });
});
