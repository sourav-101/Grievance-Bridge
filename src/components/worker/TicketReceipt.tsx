"use client";
import { CategoryPicto } from "./Pictos";
import { Download } from "lucide-react";
import { toDataURL } from "qrcode";
import { useEffect, useState } from "react";
import { useLanguage } from "@/components/shared/LanguageProvider";
import { categoryLabel, statusLabel } from "@/lib/i18n";
import { statusSpeech } from "@/lib/grievances/ticket-speech";
import type { WorkerTicketView } from "@/lib/types";
import { StatusChip, StatusSteps } from "./StatusChip";
import { SunoButton } from "./SunoButton";

const fmtDate = (iso: string, lang: "hi" | "en") =>
  new Date(iso).toLocaleString(lang === "en" ? "en-IN" : "hi-IN", { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" });

/** Audio ticket receipt + QR card, downloadable as a PNG image. */
export function TicketReceipt({ ticket, isNew = false }: { ticket: WorkerTicketView; isNew?: boolean }) {
  const [qr, setQr] = useState<string | null>(null);
  const { lang, t } = useLanguage();
  const english = lang === "en";
  const catLabel = categoryLabel(ticket.category, t);
  const place = english ? ticket.locationEn : ticket.location;
  const statusUrl = typeof window !== "undefined" ? `${window.location.origin}/status?token=${ticket.token}` : "";

  useEffect(() => {
    if (!statusUrl) return;
    toDataURL(statusUrl, { margin: 1, width: 360, color: { dark: "#1c2733", light: "#ffffff" } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [statusUrl]);

  async function download() {
    const W = 1080;
    const H = 1500;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const family = getComputedStyle(document.body).fontFamily;
    ctx.fillStyle = "#f6f4ef";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#0f766e";
    ctx.fillRect(0, 0, W, 170);
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 64px ${family}`;
    ctx.fillText(t("श्रमिक सहायता · IIT रुड़की", "Worker Help · IIT Roorkee"), 60, 108);

    ctx.fillStyle = "#5b6675";
    ctx.font = `600 44px ${family}`;
    ctx.fillText(t("शिकायत टोकन", "Complaint token"), 60, 270);
    ctx.fillStyle = "#1c2733";
    ctx.font = `800 220px ${family}`;
    ctx.fillText(ticket.token.split("").join(" "), 60, 470);

    ctx.font = `600 52px ${family}`;
    const lines = [
      `${t("विषय", "Subject")}: ${catLabel}`,
      `${t("जगह", "Place")}: ${place}`,
      `${t("स्थिति", "Status")}: ${statusLabel(ticket.status, t)}`,
      `${t("तारीख", "Date")}: ${fmtDate(ticket.createdAt, lang)}`,
      ticket.isAnonymous ? t("गुमनाम शिकायत", "Anonymous complaint") : "",
    ].filter(Boolean);
    lines.forEach((l, i) => ctx.fillText(l, 60, 600 + i * 80));

    if (qr) {
      const img = new Image();
      img.src = qr;
      await img.decode();
      ctx.drawImage(img, W - 60 - 380, 980, 380, 380);
    }
    ctx.fillStyle = "#5b6675";
    ctx.font = `400 40px ${family}`;
    ctx.fillText(t("स्थिति जानने के लिए", "To check status,"), 60, 1120);
    ctx.fillText(t("QR स्कैन करें या", "scan the QR or"), 60, 1175);
    ctx.fillText(t("टोकन नंबर बोलें।", "say the token number."), 60, 1230);

    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `shikayat-token-${ticket.token}.png`;
    a.click();
  }

  return (
    <article className="overflow-hidden rounded-xl border border-line shadow-sm bg-white shadow-lg">
      <div className={`px-5 py-4 text-white ${isNew ? "bg-ok" : "hero-band"}`}>
        <p className="text-2xl font-bold">{isNew ? t("शिकायत दर्ज हो गई", "Complaint registered") : t("शिकायत की रसीद", "Complaint receipt")}</p>
      </div>
      <div className="space-y-4 p-5">
        <div>
          <p className="text-lg font-bold text-ink-soft">{t("आपका टोकन नंबर", "Your token number")}</p>
          <p className="text-7xl font-bold tracking-[0.18em]" aria-label={`${t("टोकन", "Token")} ${ticket.token.split("").join(" ")}`}>
            {ticket.token}
          </p>
        </div>
        <StatusSteps status={ticket.status} />
        <div className="flex flex-wrap gap-2">
          <StatusChip status={ticket.status} large />
          {ticket.isAnonymous && <span className="rounded-full bg-sec-rights px-3 py-1.5 text-base font-bold text-white">{t("गुमनाम", "Anonymous")}</span>}
          {ticket.isEmergency && <span className="rounded-full bg-danger px-3 py-1.5 text-base font-bold text-white">{t("आपातकाल", "Emergency")}</span>}
          {ticket.hasPhoto && <span className="rounded-full bg-paper-deep px-3 py-1.5 text-base font-bold text-ink">📷 {t("फोटो जुड़ी है", "Photo attached")}</span>}
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xl">
          <dt className="font-bold">{t("विषय", "Subject")}:</dt>
          <dd>
            <CategoryPicto category={ticket.category} className="mr-1 inline size-8 align-middle" />
            {catLabel}
          </dd>
          <dt className="font-bold">{t("जगह", "Place")}:</dt>
          <dd>{place}</dd>
          <dt className="font-bold">{t("तारीख", "Date")}:</dt>
          <dd>{fmtDate(ticket.createdAt, lang)}</dd>
        </dl>
        {ticket.resolutionNoteHindi && (
          <div className="rounded-2xl bg-paper p-3">
            <p className="text-base font-bold">{t("एस्टेट ऑफिस का संदेश:", "Message from the Estate Office:")}</p>
            <p className="text-xl">{ticket.resolutionNoteHindi}</p>
          </div>
        )}
        <div className="flex items-center gap-4">
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt={t(`टोकन ${ticket.token} का QR कोड`, `QR code for token ${ticket.token}`)} className="size-32 rounded-lg border-2 border-line" />
          )}
          <p className="text-base text-ink-soft">{t("इस QR को स्कैन करके या टोकन नंबर बोलकर कभी भी स्थिति जान सकते हैं।", "Scan this QR or say the token number to check the status any time.")}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <SunoButton text={statusSpeech(ticket, english)} id={`receipt-${ticket.token}`} size="lg" label={t("रसीद सुनें", "Listen to receipt")} />
          <button
            onClick={download}
            className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-line shadow-sm bg-white text-xl font-bold"
          >
            <Download className="size-6" aria-hidden /> {t("सेव करें", "Save")}
          </button>
        </div>
      </div>
    </article>
  );
}
