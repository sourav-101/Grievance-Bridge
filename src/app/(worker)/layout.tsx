import { SpeechProvider } from "@/components/shared/SpeechProvider";
import { WorkerProvider } from "@/components/worker/WorkerProvider";
import { WorkerShell } from "@/components/worker/WorkerShell";

export default function WorkerLayout({ children }: { children: React.ReactNode }) {
  return (
    <SpeechProvider>
      <WorkerProvider>
        <WorkerShell>{children}</WorkerShell>
      </WorkerProvider>
    </SpeechProvider>
  );
}
