import { matchAccount, type Account } from "@/lib/email/classify";
import { parsedTransactionSchema } from "@/lib/email/parsers/types";
import type { CapturedMessage } from "./payload";
import type { MessageParser } from "./parsers";

export type CaptureInstitution = {
  id: string;
  slug: string;
  name: string;
  smsSenders: string[];
  appPackages: string[];
};

export type CaptureContext = { institutions: CaptureInstitution[]; accounts: Account[]; parsers: MessageParser[] };

export type CaptureOutcome =
  | { kind: "transaction"; parser: string; parserVersion: number; accountId: string; transaction: import("@/lib/email/parsers/types").ParsedTransaction }
  | { kind: "info"; note: string; parser: string; parserVersion: number }
  | { kind: "flagged"; note: string }
  | { kind: "failed"; note: string; parser?: string; parserVersion?: number };

/** SMS sender IDs vary in case and punctuation ("BPI", "Bpi", "BPI-ALERTS"); compare letters and digits only. */
export function normalizeSmsSender(sender: string): string {
  return sender.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Chat apps where banks run business accounts. Their notifications are matched by chat name (the title)
 * against the institution's sender names, the same way SMS sender IDs are.
 */
export const MESSENGER_APPS = new Set(["com.viber.voip"]);

/** Who a captured message is really from: the chat name for messenger apps, otherwise the sender. */
export function effectiveSender(msg: CapturedMessage): { kind: "app" | "name"; value: string } {
  if (msg.channel === "notification" && MESSENGER_APPS.has(msg.sender.toLowerCase())) {
    return { kind: "name", value: msg.title ?? "" };
  }
  return msg.channel === "notification" ? { kind: "app", value: msg.sender } : { kind: "name", value: msg.sender };
}

export function messageInstitution(msg: CapturedMessage, institutions: CaptureInstitution[]): CaptureInstitution | null {
  const from = effectiveSender(msg);
  if (from.kind === "app") {
    const app = from.value.toLowerCase();
    return institutions.find((i) => i.appPackages.some((p) => p.toLowerCase() === app)) ?? null;
  }
  const sender = normalizeSmsSender(from.value);
  if (!sender) return null;
  return institutions.find((i) => i.smsSenders.some((s) => normalizeSmsSender(s) === sender)) ?? null;
}

export function classifyCapture(msg: CapturedMessage, receivedAt: string, ctx: CaptureContext): CaptureOutcome {
  const institution = messageInstitution(msg, ctx.institutions);
  if (!institution) {
    const from = effectiveSender(msg);
    const what =
      msg.channel === "sms" ? `Texts from ${msg.sender}` : from.kind === "name" ? `Chats from ${from.value || "an unnamed contact"}` : `Notifications from ${msg.sender}`;
    return { kind: "flagged", note: `${what} aren't from a known bank or e-wallet.` };
  }

  const parser = ctx.parsers.find((p) => p.institution === institution.slug && p.matches(msg));
  if (!parser) return { kind: "failed", note: `No reader for this ${institution.name} message yet.` };

  const tag = { parser: parser.id, parserVersion: parser.version };
  let candidate;
  try {
    candidate = parser.parse(msg, receivedAt);
  } catch {
    return { kind: "failed", note: "Couldn't read this message.", ...tag };
  }
  if (!candidate) {
    return parser.info ? { kind: "info", note: parser.info, ...tag } : { kind: "failed", note: "This message doesn't contain a transaction.", ...tag };
  }
  const parsed = parsedTransactionSchema.safeParse(candidate);
  if (!parsed.success) return { kind: "failed", note: "Couldn't read the amount or time in this message.", ...tag };

  const accountId = matchAccount(parsed.data, { id: institution.id, slug: institution.slug, name: institution.name, emailDomains: [] }, ctx.accounts);
  if (!accountId) {
    const hint = parsed.data.last4 ? ` ending in ${parsed.data.last4}` : "";
    return { kind: "failed", note: `Add your ${institution.name} account${hint} so this can be matched.`, ...tag };
  }
  return { kind: "transaction", ...tag, accountId, transaction: parsed.data };
}
