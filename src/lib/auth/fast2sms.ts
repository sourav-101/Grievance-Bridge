import "server-only";
import { env } from "../env";
import { UpstreamError, fetchWithTimeout } from "../http";

const ENDPOINT = "https://www.fast2sms.com/dev/bulkV2";

/**
 * Build the SMS text for the Quick SMS route. The final line follows the
 * WebOTP format ("@domain #code") so Chrome on Android can auto-fill the code.
 */
export function buildOtpMessage(code: string, domain: string): string {
  return `IIT Roorkee Shramik Portal: aapka login OTP ${code} hai. Kisi ko na batayein.\n\n@${domain} #${code}`;
}

export async function sendOtpSms(phone: string, code: string): Promise<void> {
  const apiKey = env("FAST2SMS_API_KEY");
  const route = (process.env.FAST2SMS_ROUTE || "q").toLowerCase();
  const domain = env("NEXT_PUBLIC_APP_DOMAIN", "localhost");

  let body: Record<string, string>;
  if (route === "otp") {
    body = { route: "otp", variables_values: code, numbers: phone };
  } else if (route === "dlt") {
    body = {
      route: "dlt",
      sender_id: env("FAST2SMS_DLT_SENDER_ID"),
      message: env("FAST2SMS_DLT_TEMPLATE_ID"),
      variables_values: code,
      numbers: phone,
    };
  } else {
    body = { route: "q", message: buildOtpMessage(code, domain), numbers: phone };
  }

  const res = await fetchWithTimeout(
    ENDPOINT,
    {
      method: "POST",
      headers: { authorization: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    15000,
  );
  const data = (await res.json().catch(() => ({}))) as { return?: boolean; message?: unknown };
  if (!res.ok || data.return !== true) {
    throw new UpstreamError("SMS", `Fast2SMS error ${res.status}: ${JSON.stringify(data.message ?? data)}`, res.status);
  }
}
