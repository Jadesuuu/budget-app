import type { Message } from "./message";

/**
 * Gmail's "Forwarding Confirmation" email, sent when a mailbox adds the Budget address as a forwarding target.
 * The format below follows Gmail's message as commonly seen; confirm against a real one once forwarding
 * is set up, and save it (redacted) under fixtures/emails/gmail/.
 */
export type ForwardingConfirmation = { code: string; requestedBy: string };

const GOOGLE_SENDERS = new Set(["forwarding-noreply@google.com"]);

export function readForwardingConfirmation(msg: Message): ForwardingConfirmation | null {
  if (!GOOGLE_SENDERS.has(msg.from)) return null;
  const haystack = `${msg.subject}\n${msg.text}`;
  const code = /confirmation code:\s*(\d{6,12})/i.exec(haystack)?.[1] ?? /\(#(\d{6,12})\)/.exec(msg.subject)?.[1];
  const requestedBy =
    /([^\s<>()]+@[^\s<>()]+)\s+has requested to automatically forward/i.exec(msg.text)?.[1] ??
    /receive mail from\s+([^\s<>()]+@[^\s<>()]+)/i.exec(msg.subject)?.[1];
  if (!code || !requestedBy) return null;
  return { code, requestedBy: requestedBy.toLowerCase().replace(/[.,;]+$/, "") };
}
