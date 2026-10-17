import type { ShopSettings } from "./orders-core.ts";

/**
 * Tells the admin about a new order. WhatsApp goes through CallMeBot (free, for messaging
 * your own phone: https://www.callmebot.com/blog/free-api-whatsapp-messages/); email through
 * Resend (RESEND_API_KEY in Vercel). A failed notification never loses an order: it is
 * already saved and shows in the admin.
 */
export async function sendWhatsApp({ phone, apiKey }: ShopSettings["whatsapp"], text: string) {
  if (!phone || !apiKey) throw new Error("Add the WhatsApp number and the CallMeBot key first.");
  const url = new URL("https://api.callmebot.com/whatsapp.php");
  url.search = new URLSearchParams({ phone: phone.replace(/[^\d+]/g, ""), text, apikey: apiKey }).toString();
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  const body = await res.text();
  // CallMeBot answers 200 with an explanation when the key or number is wrong.
  if (!res.ok || /invalid|not (yet )?activated|error/i.test(body))
    throw new Error(`WhatsApp (CallMeBot) refused the message: ${body.replace(/<[^>]+>/g, " ").trim().slice(0, 160)}`);
}

export async function sendEmail({ address }: ShopSettings["email"], subject: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Email isn't set up: add RESEND_API_KEY in Vercel (see README), then redeploy.");
  if (!address) throw new Error("Add the email address first.");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "Arabica orders <onboarding@resend.dev>",
      to: [address],
      subject,
      text,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Email (Resend) refused the message: ${(await res.text()).slice(0, 160)}`);
}

/** Sends to every channel that's turned on; logs failures instead of throwing. */
export async function notifyAdmin(settings: ShopSettings, subject: string, text: string) {
  const jobs = [
    settings.whatsapp.enabled && sendWhatsApp(settings.whatsapp, text),
    settings.email.enabled && sendEmail(settings.email, subject, text),
  ].filter((j): j is Promise<void> => Boolean(j));
  for (const r of await Promise.allSettled(jobs))
    if (r.status === "rejected") console.error("Order notification failed:", r.reason);
}
