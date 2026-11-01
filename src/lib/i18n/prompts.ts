/**
 * Fixed spoken prompts. Keys in PUBLIC_PROMPTS may be synthesised WITHOUT a
 * login (e.g. on the login screen); free text TTS requires a session.
 */
export const PUBLIC_PROMPTS = {
  welcome: "नमस्ते! IIT रुड़की श्रमिक सहायता में आपका स्वागत है। अपना मोबाइल नंबर डालें और नीला बटन दबाएं।",
  enter_otp: "आपके फ़ोन पर चार अंकों का OTP भेजा गया है। उसे यहाँ डालें।",
  pin_create: "अपना नया चार अंकों का गुप्त PIN बनाएं। यह PIN किसी को न बताएं। 1111 या 1234 जैसा आसान PIN न चुनें।",
  pin_confirm: "वही चार अंक फिर से दबाएं।",
  pin_enter: "अपना चार अंकों का PIN दबाएं।",
  pin_reset: "एस्टेट ऑफिस से मिला छह अंकों का कोड दबाएं।",
  pin_forgot: "PIN भूल गए? अपना आधार या पहचान पत्र लेकर एस्टेट ऑफिस जाएं। वहाँ आपको एक नया कोड मिलेगा।",
  onboarding_name: "अपना नाम और उम्र बोलें। जैसे: मेरा नाम रमेश है, मेरी उम्र पैंतीस साल है। बोलने के लिए माइक बटन दबाएं।",
  onboarding_work: "आप कौन सा काम करते हैं? अपनी तस्वीर वाला बटन दबाएं।",
  onboarding_agency: "आप किस ठेकेदार एजेंसी के साथ काम करते हैं? अगर पता नहीं है तो 'पता नहीं' दबाएं।",
  onboarding_dialect: "आप किस बोली में सुनना पसंद करेंगे? एक बटन दबाएं।",
} as const;

export type PublicPromptKey = keyof typeof PUBLIC_PROMPTS;

export const PUBLIC_PROMPTS_EN: Record<PublicPromptKey, string> = {
  welcome: "Welcome to the IIT Roorkee worker help portal. Enter your mobile number and press the blue button.",
  enter_otp: "A four digit OTP has been sent to your phone. Enter it here.",
  pin_create: "Create a new secret four digit PIN. Do not tell anyone. Do not choose an easy PIN like 1111 or 1234.",
  pin_confirm: "Press the same four digits again.",
  pin_enter: "Press your four digit PIN.",
  pin_reset: "Press the six digit code you got from the Estate Office.",
  pin_forgot: "Forgot your PIN? Take your Aadhaar or ID card to the Estate Office. They will give you a new code.",
  onboarding_name: "Say your name and age. For example: My name is Ramesh, I am thirty five years old. Press the mic button to speak.",
  onboarding_work: "What work do you do? Press the button with your picture.",
  onboarding_agency: "Which contractor agency do you work with? If you don't know, press 'Don't know'.",
  onboarding_dialect: "Which language would you like to hear? Press a button.",
};

/** Fixed public prompt in the requested language. */
export const publicPrompt = (key: PublicPromptKey, english: boolean): string => (english ? PUBLIC_PROMPTS_EN[key] : PUBLIC_PROMPTS[key]);
export const isPublicPromptKey = (k: unknown): k is PublicPromptKey => typeof k === "string" && k in PUBLIC_PROMPTS;

export const SPOKEN = {
  greeting: (name: string) => `नमस्ते ${name} जी, आज आपकी क्या सहायता करें? सवाल पूछने या शिकायत करने के लिए नीचे माइक बटन दबाकर बोलें।`,
  notHeard: "माफ़ कीजिए, आपकी आवाज़ साफ़ नहीं आई। कृपया माइक बटन दबाकर फिर से बोलें।",
  help: "मैं आपको सरकारी योजनाओं, वेतन, स्वास्थ्य शिविर और ज़रूरी कागज़ों की जानकारी दे सकता हूँ, और आपकी शिकायत दर्ज कर सकता हूँ। कृपया अपना सवाल या शिकायत बोलें।",
  askToken: "कृपया अपनी शिकायत का चार अंकों का टोकन नंबर बोलें या लिखें।",
  ticketNotFound: "इस टोकन नंबर की कोई शिकायत नहीं मिली। कृपया नंबर जांच कर फिर से बोलें।",
  grievanceHome:
    "शिकायत करने के लिए माइक बटन दबाकर अपनी समस्या और जगह बताएं। या नीचे से समस्या की तस्वीर और जगह चुनें। नाम छुपाना हो तो गुमनाम बटन चालू करें।",
  feedbackThanks: "आपकी राय के लिए धन्यवाद।",
  emergency:
    "आपातकाल में घबराएं नहीं। चोट या करंट लगने पर अस्पताल को फ़ोन करें, किसी खतरे में कैंपस सुरक्षा को, और उत्पीड़न होने पर महिला प्रकोष्ठ को फ़ोन करें।",
};

export const SPOKEN_EN: typeof SPOKEN = {
  greeting: (name: string) => `Hello ${name}, how can I help you today? To ask a question or make a complaint, press the mic button and speak.`,
  notHeard: "Sorry, I could not hear you clearly. Please press the mic button and speak again.",
  help: "I can tell you about government schemes, wages, health camps and documents, and I can register your complaint. Please say your question or complaint.",
  askToken: "Please say or type the four digit token number of your complaint.",
  ticketNotFound: "No complaint was found with this token number. Please check the number and try again.",
  grievanceHome:
    "To complain, press the mic button and say your problem and the place. Or choose a picture of the problem and the place below. To hide your name, turn on the anonymous switch.",
  feedbackThanks: "Thank you for your feedback.",
  emergency:
    "Don't panic in an emergency. For an injury or electric shock call the hospital, for danger call campus security, and for harassment call the women's cell.",
};

/** Fixed spoken lines in the worker's language (English for the "english" dialect). */
export const spokenFor = (dialect: string | null | undefined): typeof SPOKEN => (dialect === "english" ? SPOKEN_EN : SPOKEN);
