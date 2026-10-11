import type { Message } from "./message";

/**
 * Gmail's "Forwarding Confirmation" email, sent when a mailbox adds the Budget address as a forwarding target.
 * Older versions carried a numeric code; current ones (seen October 2026) only have a confirmation link, which
 * the mailbox owner must open while signed in. Fixtures: fixtures/emails/_synthetic/gmail-forwarding-*.eml.
 */
export type ForwardingConfirmation = { code: string | null; confirmUrl: string | null; requestedBy: string };

const GOOGLE_SENDERS = new Set(["forwarding-noreply@google.com"]);
// "vf-" confirms; the same email also has a "uf-" link that cancels, which must never be offered.
const CONFIRM_URL = /https:\/\/mail-settings\.google\.com\/mail\/vf-[^\s<>"')\]]+(?:\][^\s<>"')]*)?/;

export function readForwardingConfirmation(msg: Message): ForwardingConfirmation | null {
  if (!GOOGLE_SENDERS.has(msg.from)) return null;
  const haystack = `${msg.subject}\n${msg.text}`;
  const code = /confirmation code:\s*(\d{6,12})/i.exec(haystack)?.[1] ?? /\(#(\d{6,12})\)/.exec(msg.subject)?.[1] ?? null;
  const confirmUrl = CONFIRM_URL.exec(`${msg.text}\n${msg.html}`)?.[0] ?? null;
  const requestedBy =
    /([^\s<>()]+@[^\s<>()]+)\s+has requested to automatically forward/i.exec(msg.text)?.[1] ??
    /receive mail from\s+([^\s<>()]+@[^\s<>()]+)/i.exec(msg.subject)?.[1];
  if ((!code && !confirmUrl) || !requestedBy) return null;
  return { code, confirmUrl, requestedBy: requestedBy.toLowerCase().replace(/[.,;]+$/, "") };
}
