import type { Metadata, Viewport } from "next";
import { Noto_Sans, Noto_Sans_Devanagari } from "next/font/google";
import { LanguageProvider } from "@/components/shared/LanguageProvider";
import "./globals.css";

// Same family as india.gov.in: Noto Sans (Latin) + Noto Sans Devanagari (Hindi).
const noto = Noto_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-noto", display: "swap" });
const notoDeva = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-deva",
  display: "swap",
});

export const metadata: Metadata = {
  title: "श्रमिक सहायता पोर्टल · IIT Roorkee",
  description: "Voice-first information and grievance portal for IIT Roorkee contract workers.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f766e",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hi" className={`${noto.variable} ${notoDeva.variable}`}>
      <body className="min-h-dvh bg-paper text-ink antialiased">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
