/**
 * Site map + keyword fallback for the help assistant (pure — unit tested).
 * The LLM may only suggest links from ALLOWED_ACTIONS.
 */

export interface AssistantAction {
  label: string;
  href: string;
}

export const ALLOWED_ACTIONS: Record<string, string> = {
  "/": "होम पेज",
  "/grievance": "शिकायत दर्ज करें",
  "/history": "मेरा इतिहास / मेरी शिकायतें",
  "/status": "टोकन से स्थिति देखें",
  "/section/schemes": "सरकारी योजनाएं",
  "/section/wages": "वेतन / हाज़िरी",
  "/section/health": "स्वास्थ्य शिविर / अस्पताल",
  "/section/checklist": "ज़रूरी कागज़",
  "/section/rights": "आपके अधिकार",
  "#emergency": "आपातकालीन नंबर",
  "/login": "लॉग इन",
};

const ACTION_LABELS_EN: Record<string, string> = {
  "/": "Home",
  "/grievance": "File a complaint",
  "/history": "My history",
  "/status": "Check status by token",
  "/section/schemes": "Government schemes",
  "/section/wages": "Wages / Attendance",
  "/section/health": "Health camps / Hospital",
  "/section/checklist": "Documents needed",
  "/section/rights": "Your rights",
  "#emergency": "Emergency numbers",
  "/login": "Log in",
};

const actionLabel = (href: string, lang: "hi" | "en") => (lang === "en" ? ACTION_LABELS_EN[href] : ALLOWED_ACTIONS[href]);

export const SITE_MAP = `
PAGES OF THE "श्रमिक सहायता पोर्टल" (IIT Roorkee contract worker portal):
- "/" Home: at the top a red "शिकायत दर्ज करें" box with a microphone to record a complaint; below it "मेरी दर्ज शिकायतें" (my complaints); then information cards.
- "/grievance" File a complaint: press the red mic and speak the problem + place, OR choose a picture (category) and a place. A switch "गुमनाम शिकायत" hides the worker's name, phone and voice from officials and contractors. After filing, the worker gets a 4-digit token number and a receipt with QR code.
- "/history" My history: all complaints (running / resolved), messages from the Estate Office, and a 👍/👎 or 10-second voice rating after a complaint is resolved.
- "/status" Check status by typing or speaking the 4-digit token number.
- "/section/schemes" Government schemes: e-Shram, Ayushman Bharat / Atal Ayushman Uttarakhand, PM Shram Yogi Maan-dhan pension, PM Suraksha Bima, construction workers' welfare board.
- "/section/wages" Minimum wage rates, salary payment rules, overtime.
- "/section/health" IIT Roorkee hospital timings, health camps, Civil Hospital Roorkee.
- "/section/checklist" Documents needed for e-Shram, Ayushman card, Aadhaar-bank linking, construction worker registration.
- "/section/rights" Safety equipment (PPE), how anonymous complaints work, women's safety / harassment.
- "#emergency" Emergency helplines (campus security, hospital, women's cell, 112, 108, 181) — red "आपातकाल" button at the top.
- Every page has a "सुनें" (listen) button that reads the text aloud, and a language button "अ/A" at the top to switch between Hindi and English.
- Login: mobile number + 4-digit PIN. Forgot PIN / locked: go to the Estate Office with ID; they give a 6-digit code to set a new PIN.
`;

/** [keywords, Hindi reply, English reply, links] — first match wins. */
const RULES: [string[], string, string, string[]][] = [
  [["आपात", "emergency", "चोट", "करंट", "आग", "एम्बुलेंस", "ambulance", "112", "108", "injur", "fire"],
    "आपातकाल में तुरंत फ़ोन करें। नीचे बटन दबाकर सभी आपातकालीन नंबर देखें। बड़ी आपात स्थिति में 112 पर फ़ोन करें।",
    "In an emergency, call right away. Press the button below to see all emergency numbers. For a serious emergency, call 112.",
    ["#emergency"]],
  [["pin", "पिन", "भूल", "लॉग", "login", "लॉक", "forgot", "locked"],
    "PIN भूल गए हैं तो अपना आधार या पहचान पत्र लेकर एस्टेट ऑफिस जाएं। वहाँ 6 अंकों का कोड मिलेगा, उससे नया PIN बना सकते हैं।",
    "If you forgot your PIN, take your Aadhaar or ID card to the Estate Office. They will give you a 6 digit code to make a new PIN.",
    ["/login"]],
  [["टोकन", "token", "स्थिति", "status", "क्या हुआ"],
    "अपनी शिकायत की स्थिति जानने के लिए टोकन वाला पेज खोलें और 4 अंकों का टोकन नंबर डालें या बोलें।",
    "To check your complaint, open the token page and type or say your 4 digit token number.",
    ["/status", "/history"]],
  [["गुमनाम", "नाम छुपा", "anonymous", "ठेकेदार को पता", "hide my name"],
    "शिकायत करते समय 'गुमनाम शिकायत' बटन चालू करें। तब आपका नाम, फ़ोन नंबर और आवाज़ किसी अधिकारी या ठेकेदार को नहीं दिखेगी।",
    "When filing a complaint, turn on the 'Anonymous complaint' switch. Then your name, phone number and voice are not shown to any official or contractor.",
    ["/grievance"]],
  [["शिकायत", "complain", "grievance", "समस्या", "पानी", "वेतन नहीं", "पैसा नहीं", "problem", "water"],
    "शिकायत करने के लिए लाल माइक बटन दबाएं, अपनी समस्या और जगह बोलें, फिर हरा बटन दबाएं। आपको एक टोकन नंबर मिलेगा।",
    "To complain, press the red mic button, say your problem and the place, then press the green button. You will get a token number.",
    ["/grievance"]],
  [["इतिहास", "history", "पुरानी", "मेरी शिकायतें", "my complaints"],
    "आपकी सभी शिकायतें 'मेरा इतिहास' पेज पर हैं।",
    "All your complaints are on the 'My history' page.",
    ["/history"]],
  [["वेतन", "मज़दूरी", "मजदूरी", "salary", "wage", "ओवरटाइम", "overtime"],
    "न्यूनतम वेतन और भुगतान के नियम 'वेतन / हाज़िरी' पेज पर हैं।",
    "Minimum wages and payment rules are on the 'Wages' page.",
    ["/section/wages"]],
  [["अस्पताल", "hospital", "स्वास्थ्य", "health", "शिविर", "डॉक्टर", "इलाज", "doctor"],
    "अस्पताल का समय और स्वास्थ्य शिविर की जानकारी 'स्वास्थ्य शिविर' पेज पर है।",
    "Hospital timings and health camp details are on the 'Health camps' page.",
    ["/section/health"]],
  [["कागज़", "कागज", "दस्तावेज़", "document", "आधार", "aadhaar"],
    "योजनाओं के लिए ज़रूरी कागज़ों की सूची 'ज़रूरी कागज़' पेज पर है।",
    "The list of documents needed for schemes is on the 'Documents needed' page.",
    ["/section/checklist"]],
  [["योजना", "scheme", "ई-श्रम", "e-shram", "आयुष्मान", "ayushman", "पेंशन", "pension", "बीमा", "insurance"],
    "सरकारी योजनाओं की जानकारी 'योजनाएं' पेज पर है।",
    "Information about government schemes is on the 'Schemes' page.",
    ["/section/schemes", "/section/checklist"]],
  [["बोली", "भाषा", "language", "गढ़वाली", "कुमाऊँनी", "भोजपुरी", "english", "hindi"],
    "ऊपर 'अ/A' बटन दबाकर हिंदी या English चुनें।",
    "Press the 'अ/A' button at the top to choose Hindi or English.",
    []],
];

/** Keyword fallback used when the AI service is unavailable. */
export function ruleBasedAnswer(message: string, lang: "hi" | "en" = "hi"): { reply: string; actions: AssistantAction[] } {
  const m = message.toLowerCase();
  const act = (hrefs: string[]) => hrefs.map((href) => ({ href, label: actionLabel(href, lang) }));
  const hit = RULES.find(([words]) => words.some((w) => m.includes(w)));
  if (hit) return { reply: lang === "en" ? hit[2] : hit[1], actions: act(hit[3]) };
  return {
    reply:
      lang === "en"
        ? "I can help you use this website. You can ask about complaints, tokens, schemes, wages, the hospital or your PIN."
        : "मैं इस वेबसाइट को इस्तेमाल करने में आपकी मदद कर सकता हूँ। आप शिकायत, टोकन, योजनाएं, वेतन, अस्पताल या PIN के बारे में पूछ सकते हैं।",
    actions: act(["/grievance", "/status", "/section/schemes"]),
  };
}

/** Keep only allowed links and give them our own labels. */
export function sanitizeActions(raw: unknown, lang: "hi" | "en" = "hi"): AssistantAction[] {
  if (!Array.isArray(raw)) return [];
  const out: AssistantAction[] = [];
  for (const a of raw) {
    const href = typeof a === "string" ? a : (a as { href?: unknown })?.href;
    if (typeof href === "string" && href in ALLOWED_ACTIONS && !out.some((o) => o.href === href)) {
      out.push({ href, label: actionLabel(href, lang) });
    }
  }
  return out.slice(0, 3);
}
