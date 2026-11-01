import { describe, expect, it } from "vitest";
import { chunkForTts, devanagariDigitsToAscii, extractTicketToken, parseAgeDigits, spellToken, truncate } from "@/lib/text";
import { receiptSpeech, statusSpeech } from "@/lib/grievances/ticket-speech";

describe("ticket token extraction", () => {
  it("reads typed and Devanagari digits", () => {
    expect(extractTicketToken("मेरा टोकन 4821 है")).toBe("4821");
    expect(extractTicketToken("४८२१")).toBe("4821");
    expect(devanagariDigitsToAscii("०९")).toBe("09");
  });

  it("reads digits spoken one by one", () => {
    expect(extractTicketToken("चार आठ दो एक")).toBe("4821");
    expect(extractTicketToken("टोकन है पाँच, शून्य, सात, नौ")).toBe("5079");
    expect(extractTicketToken("48 21")).toBe("4821");
  });

  it("rejects too-short numbers", () => {
    expect(extractTicketToken("मेरा नंबर 12 है")).toBeNull();
    expect(extractTicketToken("")).toBeNull();
  });
});

describe("speech text helpers", () => {
  it("spells tokens digit by digit", () => {
    expect(spellToken("4821")).toBe("4 8 2 1");
  });

  it("chunks long text on sentence boundaries", () => {
    const sentence = "यह एक वाक्य है। ";
    const text = sentence.repeat(400);
    const chunks = chunkForTts(text, 2400);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= 2400)).toBe(true);
    expect(chunks.join(" ").replace(/\s+/g, " ")).toBe(text.trim().replace(/\s+/g, " "));
    expect(chunkForTts("")).toEqual([]);
  });

  it("truncates with an ellipsis", () => {
    expect(truncate("abcdef", 4)).toBe("abc…");
    expect(truncate("abc", 4)).toBe("abc");
  });

  it("parses a two-digit age", () => {
    expect(parseAgeDigits("मेरी उम्र 35 साल")).toBe(35);
    expect(parseAgeDigits("उम्र ४२")).toBe(42);
    expect(parseAgeDigits("पता नहीं")).toBeNull();
  });

  it("builds spoken status and receipt lines", () => {
    const s = statusSpeech({ token: "4821", category: "Sanitation", location: "गोविंद भवन", status: "In Progress", resolutionNoteHindi: null });
    expect(s).toContain("4 8 2 1");
    expect(s).toContain("काम चल रहा है");
    const r = receiptSpeech("4821", "सफ़ाई / पानी", "गोविंद भवन", true, false);
    expect(r).toContain("गुमनाम");
    expect(r).not.toContain("आपातकालीन");
  });
});
