"use client";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useLanguage } from "@/components/shared/LanguageProvider";
import { TicketReceipt } from "@/components/worker/TicketReceipt";
import { getJson } from "@/lib/client/api";
import type { WorkerTicketView } from "@/lib/types";

function TicketView() {
  const { token } = useParams<{ token: string }>();
  const isNew = useSearchParams().get("new") === "1";
  const [ticket, setTicket] = useState<WorkerTicketView | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");
  const { t } = useLanguage();

  useEffect(() => {
    getJson<{ ticket: WorkerTicketView | null; isOwner: boolean }>(`/api/tickets/status?token=${encodeURIComponent(token)}`)
      .then((r) => {
        if (r.ticket && r.isOwner) {
          setTicket(r.ticket);
          setState("ok");
        } else setState("missing");
      })
      .catch(() => setState("missing"));
  }, [token]);

  if (state === "loading") return <p className="py-10 text-center text-xl">{t("लोड हो रहा है…", "Loading…")}</p>;
  if (state === "missing" || !ticket)
    return (
      <div className="mx-4 my-6 space-y-3 rounded-xl bg-white p-5 text-xl sm:mx-auto sm:max-w-3xl">
        <p>{t("यह रसीद नहीं मिली, या यह शिकायत आपकी नहीं है।", "Receipt not found, or this complaint is not yours.")}</p>
        <Link href={`/status?token=${token}`} className="font-bold underline">
          {t("टोकन से स्थिति देखें →", "Check status by token →")}
        </Link>
      </div>
    );

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <TicketReceipt ticket={ticket} isNew={isNew} />
      <Link href="/history" className="block text-center text-xl font-bold underline">
        {t("मेरी सभी शिकायतें देखें →", "See all my complaints →")}
      </Link>
    </div>
  );
}

export default function TicketPage() {
  return (
    <Suspense fallback={<p className="py-10 text-center text-xl">…</p>}>
      <TicketView />
    </Suspense>
  );
}
