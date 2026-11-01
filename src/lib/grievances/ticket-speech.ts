/** Spoken lines for tickets (shared by server and client). */
import { GRIEVANCE_CATEGORIES, STATUS_EN, STATUS_HI } from "../constants";
import { spellToken } from "../text";
import type { WorkerTicketView } from "../types";

/** Spoken status line for a ticket (English when `english` is set). */
export function statusSpeech(
  v: Pick<WorkerTicketView, "token" | "category" | "location" | "status" | "resolutionNoteHindi"> & { locationEn?: string },
  english = false,
): string {
  if (english) {
    const parts = [
      `Complaint token ${spellToken(v.token)}.`,
      `Subject: ${GRIEVANCE_CATEGORIES[v.category].labelEn}, place: ${v.locationEn ?? v.location}.`,
      `Current status: ${STATUS_EN[v.status]}.`,
    ];
    if (v.resolutionNoteHindi) parts.push(`Message from the Estate Office: ${v.resolutionNoteHindi}`);
    return parts.join(" ");
  }
  const parts = [
    `शिकायत टोकन ${spellToken(v.token)}।`,
    `विषय: ${GRIEVANCE_CATEGORIES[v.category].labelHi}, जगह: ${v.location}।`,
    `अभी की स्थिति: ${STATUS_HI[v.status]}।`,
  ];
  if (v.resolutionNoteHindi) parts.push(`एस्टेट ऑफिस का संदेश: ${v.resolutionNoteHindi}`);
  return parts.join(" ");
}

export function receiptSpeech(token: string, categoryHi: string, locationHi: string, isAnonymous: boolean, isEmergency: boolean): string {
  return [
    "आपकी शिकायत दर्ज हो गई है।",
    `आपका टोकन नंबर है ${spellToken(token)}। फिर से, ${spellToken(token)}।`,
    `विषय: ${categoryHi}, जगह: ${locationHi}।`,
    isAnonymous ? "यह शिकायत गुमनाम है, आपका नाम किसी को नहीं दिखाया जाएगा।" : "",
    isEmergency ? "यह आपातकालीन शिकायत है। अगर किसी को चोट लगी है तो तुरंत आपातकालीन बटन से अस्पताल को फ़ोन करें।" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function receiptSpeechEn(token: string, categoryEn: string, locationEn: string, isAnonymous: boolean, isEmergency: boolean): string {
  return [
    "Your complaint has been registered.",
    `Your token number is ${spellToken(token)}. Again, ${spellToken(token)}.`,
    `Subject: ${categoryEn}, place: ${locationEn}.`,
    isAnonymous ? "This complaint is anonymous. Your name will not be shown to anyone." : "",
    isEmergency ? "This is an emergency complaint. If someone is hurt, call the hospital now using the emergency button." : "",
  ]
    .filter(Boolean)
    .join(" ");
}
