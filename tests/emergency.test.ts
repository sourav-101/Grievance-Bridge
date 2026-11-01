import { describe, expect, it } from "vitest";
import { detectEmergencyKeywords } from "@/lib/grievances/emergency";

describe("emergency keyword red-flagging", () => {
  it("flags electric shock in Hindi", () => {
    expect(detectEmergencyKeywords("सीवर के पास काम करते हुए मुझे करंट लगा")).toContain("करंट");
  });

  it("flags injury and harassment", () => {
    expect(detectEmergencyKeywords("मज़दूर घायल हो गया, खून निकल रहा है")).toEqual(expect.arrayContaining(["घायल", "खून"]));
    expect(detectEmergencyKeywords("supervisor ne harassment kiya")).toContain("harass");
  });

  it("does not fire inside unrelated words", () => {
    expect(detectEmergencyKeywords("हमारा वेतन नहीं मिला")).toEqual([]); // "मारा" inside "हमारा"
    expect(detectEmergencyKeywords("आगे से ध्यान रखेंगे")).toEqual([]); // "आग" inside "आगे"
    expect(detectEmergencyKeywords("they fired me without pay")).toEqual([]); // "fire" inside "fired"
  });

  it("fires on the whole word", () => {
    expect(detectEmergencyKeywords("हॉस्टल की रसोई में आग लग गई")).toEqual(["आग"]);
    expect(detectEmergencyKeywords("Fire in the workshop!")).toEqual(["fire"]);
    expect(detectEmergencyKeywords("ठेकेदार ने मुझे मारा")).toContain("मारा");
  });
});
