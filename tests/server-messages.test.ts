import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { englishServerMessage } from "@/lib/i18n/server-messages";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : p.endsWith(".ts") ? [p] : [];
  });
}

describe("English versions of server messages", () => {
  it("translates known messages and service outages", () => {
    expect(englishServerMessage("कृपया पहले लॉग इन करें।")).toBe("Please log in first.");
    expect(englishServerMessage("AI सेवा अभी उपलब्ध नहीं है। कृपया थोड़ी देर बाद फिर कोशिश करें।")).toMatch(/^The AI service/);
    expect(englishServerMessage("unknown")).toBeNull();
  });

  it("covers every fixed Hindi jsonError(...) in the worker API routes", () => {
    const routes = [...files("src/app/api").filter((f) => !f.includes(`${join("api", "admin")}`)), "src/lib/auth/session.ts", "src/lib/http.ts"];
    const missing: string[] = [];
    for (const file of routes) {
      for (const m of readFileSync(file, "utf8").matchAll(/jsonError\(\s*"([^"]*[ऀ-ॿ][^"]*)"/g)) {
        if (!englishServerMessage(m[1])) missing.push(`${file}: ${m[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
