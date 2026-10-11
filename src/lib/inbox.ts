import { APP_TIME_ZONE, todayInManila, addDays } from "./dates";

export type InboxSource = "manual" | "email" | "sms" | "recurring" | "statement";

export type InboxItem = {
  id: string;
  accountId: string;
  accountName: string;
  accountLast4: string | null;
  institutionName: string | null;
  amount: number;
  occurredAt: string;
  merchant: string | null;
  source: InboxSource;
  categoryId: string | null;
  duplicateOf: { merchant: string | null; amount: number; occurredAt: string; source: InboxSource } | null;
};

/** Short badge text for an institution or account: "BPI", "GC" (GCash), "EW" (EastWest), "SB", "AT". */
export function badgeFor(name: string): string {
  const words = name.replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  if (words.length > 1) return words.slice(0, 3).map((w) => w[0]).join("").toUpperCase();
  const word = words[0] ?? "?";
  if (word.length <= 4 && word === word.toUpperCase()) return word; // BPI, BDO, RCBC
  const capitals = word.match(/[A-Z]/g) ?? [];
  if (capitals.length >= 2) return capitals.slice(0, 3).join(""); // GCash, EastWest, UnionBank
  return word.slice(0, 2).toUpperCase();
}

const timeFmt = new Intl.DateTimeFormat("en-PH", { timeZone: APP_TIME_ZONE, hour: "numeric", minute: "2-digit" });
const dateFmt = new Intl.DateTimeFormat("en-PH", { timeZone: APP_TIME_ZONE, month: "short", day: "numeric" });

/** "8:42 PM", "yesterday", or "Oct 9", relative to Manila's calendar. */
export function describeWhen(occurredAt: string, now: Date = new Date()): string {
  const at = new Date(occurredAt);
  const day = todayInManila(at);
  const today = todayInManila(now);
  if (day === today) return timeFmt.format(at);
  if (day === addDays(today, -1)) return "yesterday";
  return dateFmt.format(at);
}

/** "From BPI email, 8:42 PM", "Recurring, Oct 15". */
export function describeSource(item: Pick<InboxItem, "source" | "institutionName" | "occurredAt">, now?: Date): string {
  const when = describeWhen(item.occurredAt, now);
  const from = item.institutionName ? `${item.institutionName} ` : "";
  switch (item.source) {
    case "email":
      return `From ${from}email, ${when}`;
    case "sms":
      return `From ${from}SMS, ${when}`;
    case "recurring":
      return `Recurring, ${when}`;
    case "statement":
      return `From statement, ${when}`;
    default:
      return `Added by you, ${when}`;
  }
}

export type TransferPair = { outId: string; inId: string; fromAccount: string; toAccount: string };

const PAIR_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Money leaving one account and the same amount arriving in another of the user's accounts within
 * 24 hours is probably a transfer. Each transaction joins at most one suggested pair (closest in time wins).
 */
export function findTransferPairs(pending: InboxItem[]): TransferPair[] {
  const candidates: (TransferPair & { gap: number })[] = [];
  for (const out of pending) {
    if (out.amount >= 0) continue;
    for (const into of pending) {
      if (into.amount !== -out.amount || into.accountId === out.accountId) continue;
      const gap = Math.abs(Date.parse(into.occurredAt) - Date.parse(out.occurredAt));
      if (gap > PAIR_WINDOW_MS) continue;
      candidates.push({ outId: out.id, inId: into.id, fromAccount: out.accountName, toAccount: into.accountName, gap });
    }
  }
  candidates.sort((a, b) => a.gap - b.gap);
  const used = new Set<string>();
  const pairs: TransferPair[] = [];
  for (const c of candidates) {
    if (used.has(c.outId) || used.has(c.inId)) continue;
    used.add(c.outId);
    used.add(c.inId);
    pairs.push({ outId: c.outId, inId: c.inId, fromAccount: c.fromAccount, toAccount: c.toAccount });
  }
  return pairs;
}
