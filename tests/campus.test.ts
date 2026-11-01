import { describe, expect, it } from "vitest";
import { CAMPUS_ZONES, autocorrectCampusTerms, levenshtein, normalizeForMatch, sttKeyterms } from "@/lib/campus";

describe("campus auto-correction", () => {
  it("normalises common Devanagari spelling variants", () => {
    expect(normalizeForMatch("गोविन्द भवन")).toBe(normalizeForMatch("गोविंद भवन"));
    expect(normalizeForMatch("थामसन")).toBe(normalizeForMatch("थॉमसन"));
  });

  it("maps a misspelt hostel name to the canonical zone", () => {
    const r = autocorrectCampusTerms("गोविन्द भवन में दो दिन से पानी नहीं आ रहा");
    expect(r.zoneIds).toEqual(["govind"]);
    expect(r.text).toContain("गोविंद भवन");
    expect(r.text).toContain("पानी नहीं आ रहा");
  });

  it("maps STT variants of Thomason Building", () => {
    const r = autocorrectCampusTerms("थामसन बिल्डिंग के पीछे कचरा पड़ा है।");
    expect(r.zoneIds).toEqual(["thomason"]);
    expect(r.text.startsWith("थॉमसन बिल्डिंग")).toBe(true);
  });

  it("handles romanised speech and keeps trailing punctuation", () => {
    const r = autocorrectCampusTerms("water problem in Kasturba Bhawan.");
    expect(r.zoneIds).toEqual(["kasturba"]);
    expect(r.text).toBe("water problem in कस्तूरबा भवन.");
  });

  it("tolerates a one-letter recognition error", () => {
    const r = autocorrectCampusTerms("राजेन्द्र भावन में बिजली नहीं है");
    expect(r.zoneIds).toEqual(["rajendra"]);
  });

  it("leaves unrelated text untouched", () => {
    const text = "मेरा वेतन तीन महीने से नहीं मिला";
    const r = autocorrectCampusTerms(text);
    expect(r.text).toBe(text);
    expect(r.zoneIds).toEqual([]);
  });

  it("levenshtein basics", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("same", "same")).toBe(0);
  });

  it("zone ids are unique and keyterms respect API limits", () => {
    const ids = CAMPUS_ZONES.map((z) => z.id);
    expect(new Set(ids).size).toBe(ids.length);
    const terms = sttKeyterms();
    expect(terms.length).toBeLessThanOrEqual(50);
    expect(terms.every((t) => t.length <= 64)).toBe(true);
  });
});
