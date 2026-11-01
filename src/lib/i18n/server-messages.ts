/**
 * English versions of the Hindi messages that API routes return (pure; used by the
 * browser's API helper when the site is in English). Keep in sync when adding
 * jsonError("…") messages to worker routes. Messages that contain numbers are
 * built with msgFor(req) on the server instead.
 */
const EXACT: Record<string, string> = {
  // sign-in / session
  "कृपया पहले लॉग इन करें।": "Please log in first.",
  "कृपया पहले अपनी प्रोफ़ाइल बनाएं।": "Please create your profile first.",
  "मोबाइल नंबर सही नहीं है।": "The mobile number is not valid.",
  "कृपया सही 10 अंकों का मोबाइल नंबर डालें।": "Please enter a valid 10 digit mobile number.",
  "बहुत ज़्यादा कोशिशें। कुछ देर बाद प्रयास करें।": "Too many attempts. Please try again later.",
  "बहुत बार OTP मांगा गया है। 15 मिनट बाद फिर कोशिश करें।": "Too many OTP requests. Try again after 15 minutes.",
  "OTP नहीं मिला। कृपया नया OTP मांगें।": "OTP not found. Please request a new OTP.",
  "OTP की समय सीमा खत्म हो गई। नया OTP मांगें।": "The OTP has expired. Request a new OTP.",
  "बहुत गलत कोशिशें। नया OTP मांगें।": "Too many wrong tries. Request a new OTP.",
  "OTP गलत है। फिर से कोशिश करें।": "Wrong OTP. Please try again.",
  "ठेकेदार एजेंसी नहीं मिली।": "Contractor agency not found.",
  // slow down
  "कृपया थोड़ी देर बाद फिर पूछें।": "Please ask again in a little while.",
  "कृपया थोड़ा रुककर कोशिश करें।": "Please wait a moment and try again.",
  "कृपया थोड़ा रुककर फिर से बोलें।": "Please wait a moment and speak again.",
  "कृपया कुछ देर बाद कोशिश करें।": "Please try again in a little while.",
  "एक घंटे में बहुत सारी शिकायतें। कृपया बाद में कोशिश करें।": "Too many complaints in one hour. Please try again later.",
  // recordings
  "आवाज़ रिकॉर्ड नहीं हुई।": "No voice was recorded.",
  "रिकॉर्डिंग बहुत लंबी है।": "The recording is too long.",
  "रिकॉर्डिंग बहुत लंबी है। 30 सेकंड से कम बोलें।": "The recording is too long. Speak for less than 30 seconds.",
  // complaints, status, feedback
  "यह शिकायत पुरानी हो गई है। कृपया फिर से बोलें।": "This complaint has expired. Please speak again.",
  "कृपया 4 अंकों का टोकन नंबर डालें।": "Please enter the 4 digit token number.",
  "शिकायत नहीं मिली।": "Complaint not found.",
  "शिकायत हल होने के बाद ही राय दें।": "You can give feedback only after the complaint is resolved.",
  "कृपया 👍 या 👎 दबाएं, या बोलकर बताएं।": "Please press 👍 or 👎, or say it.",
  "आप पहले ही राय दे चुके हैं।": "You have already given feedback.",
  "फोटो बहुत बड़ी है। कोई दूसरी फोटो चुनें।": "The photo is too large. Choose another photo.",
  "यह फोटो नहीं खुल रही। JPG या PNG फोटो चुनें।": "This photo cannot be opened. Choose a JPG or PNG photo.",
  // server problems
  "सर्वर डेटाबेस से नहीं जुड़ पा रहा है। कृपया थोड़ी देर बाद कोशिश करें।": "The server cannot reach the database. Please try again in a little while.",
  "कुछ गड़बड़ हो गई। कृपया फिर से कोशिश करें।": "Something went wrong. Please try again.",
};

const SERVICE_EN: Record<string, string> = {
  "Speech-to-text": "Speech recognition",
  "Text-to-speech": "Voice",
  AI: "AI",
  Embeddings: "Search",
  "Web search": "Web search",
  SMS: "SMS",
};

/** English for a Hindi server message, or null if it is not known (then the Hindi is shown). */
export function englishServerMessage(message: string): string | null {
  if (EXACT[message]) return EXACT[message];
  // "<service> सेवा अभी उपलब्ध नहीं है। …" from handleRouteError
  const svc = message.match(/^(.+?) सेवा अभी उपलब्ध नहीं है।/);
  if (svc) return `The ${SERVICE_EN[svc[1]] ?? svc[1]} service is not available right now. Please try again in a little while.`;
  return null;
}
