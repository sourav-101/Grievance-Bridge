import { ChatAssistant } from "@/components/shared/ChatAssistant";
import { IitrBanner } from "@/components/shared/IitrBanner";
import { PublicHeader } from "@/components/shared/PublicHeader";
import { SiteFooter } from "@/components/shared/SiteFooter";
import { SpeechProvider } from "@/components/shared/SpeechProvider";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <SpeechProvider>
      <div className="flex min-h-dvh flex-col bg-paper">
        <IitrBanner />
        <PublicHeader />
        <main className="mx-auto w-full max-w-lg flex-1 px-5 py-6">
          <div className="rounded-xl bg-white p-5 shadow-sm">{children}</div>
        </main>
        <SiteFooter links={false} />
        <ChatAssistant />
      </div>
    </SpeechProvider>
  );
}
