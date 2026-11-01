import { describe, expect, it } from "vitest";
import { guessCategory, guessFeedback, guessIntent, guessNameAndAge } from "@/lib/ai/intent-rules";

describe("keyword fallbacks (AI unavailable)", () => {
  it("routes complaints, questions and status checks", () => {
    expect(guessIntent("गोविंद भवन में दो दिन से पानी नहीं आ रहा")).toBe("grievance");
    expect(guessIntent("ठेकेदार ने तीन महीने से वेतन नहीं दिया")).toBe("grievance");
    expect(guessIntent("ई-श्रम कार्ड कैसे बनेगा?")).toBe("information");
    expect(guessIntent("वेतन कब मिलेगा?")).toBe("information");
    expect(guessIntent("मेरे टोकन 4821 की स्थिति बताइए")).toBe("status_check");
    expect(guessIntent("नमस्ते")).toBe("other");
  });

  it("guesses the grievance category", () => {
    expect(guessCategory("पानी नहीं आ रहा")).toBe("Sanitation");
    expect(guessCategory("सैलरी काट ली")).toBe("Wage Dispute");
    expect(guessCategory("हेलमेट नहीं मिला")).toBe("Safety/PPE");
    expect(guessCategory("सुपरवाइज़र गाली देता है")).toBe("Harassment");
    expect(guessCategory("कुछ और बात")).toBe("General");
  });

  it("pulls name and age from a self-introduction", () => {
    expect(guessNameAndAge("मेरा नाम रमेश कुमार है, मेरी उम्र 35 साल है")).toEqual({ fullName: "रमेश कुमार", age: 35 });
    expect(guessNameAndAge("नमस्ते").fullName).toBe("");
  });

  it("reads spoken feedback", () => {
    expect(guessFeedback("हाँ, काम ठीक हो गया")).toBe("Satisfied");
    expect(guessFeedback("कोई दिक्कत नहीं है")).toBe("Satisfied");
    expect(guessFeedback("अभी भी पानी नहीं आ रहा")).toBe("Unsatisfied");
  });
});
