import "server-only";
import webpush from "web-push";
import { loadDueItems } from "@/lib/data/due";
import { loadSpendingTxns } from "@/lib/data/spending";
import { daysBetween, todayInManila } from "@/lib/dates";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  allowance,
  everydayByDate,
  limitStatuses,
  monthOf,
  payPeriod,
  periodBudget,
  summarizeMonth,
  type CategorySetting,
} from "@/lib/spending";
import { computeAlerts, type Alert } from "./alerts";

type Db = ReturnType<typeof createAdminClient>;
export type PushTarget = { id: string; endpoint: string; p256dh: string; auth: string };

export function pushConfigured(): boolean {
  return Boolean(env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT);
}

/** Sends one notification to each device. Devices the push service says are gone are removed. */
export async function sendPush(db: Db, targets: PushTarget[], alert: Pick<Alert, "title" | "body" | "url" | "ref">) {
  if (!pushConfigured()) return 0;
  webpush.setVapidDetails(env.VAPID_SUBJECT!, env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
  const payload = JSON.stringify({ title: alert.title, body: alert.body, url: alert.url, tag: alert.ref });
  let sent = 0;
  await Promise.all(
    targets.map(async (t) => {
      try {
        await webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, payload, { TTL: 6 * 3600 });
        sent++;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await db.from("push_subscriptions").delete().eq("id", t.id);
      }
    }),
  );
  return sent;
}

function manilaHour(now: Date): number {
  return Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Asia/Manila" }).format(now));
}

/** Works out one user's alerts from their data. Admin client, so every query is filtered by userId. */
async function alertsFor(db: Db, userId: string, now: Date): Promise<Alert[]> {
  const today = todayInManila(now);
  const month = monthOf(today);
  const [profile, settings, categories] = await Promise.all([
    db.from("profiles").select("paydays, spending_limit_centavos, notify_bills, notify_spending").eq("user_id", userId).single(),
    db.from("category_settings").select("category_id, fixed, monthly_limit_centavos").eq("user_id", userId),
    db.from("categories").select("id, name").or(`user_id.is.null,user_id.eq.${userId}`),
  ]);
  if (profile.error) throw profile.error;
  if (settings.error) throw settings.error;
  if (categories.error) throw categories.error;
  const p = profile.data;
  if (!p.notify_bills && !p.notify_spending) return [];

  const period = payPeriod(today, p.paydays);
  const fixed = new Set(settings.data.filter((s) => s.fixed).map((s) => s.category_id));
  const settingMap = new Map<string, CategorySetting>(
    settings.data.map((s) => [s.category_id, { fixed: s.fixed, limit: s.monthly_limit_centavos }]),
  );
  const [due, txns] = await Promise.all([
    loadDueItems(db, today, userId),
    loadSpendingTxns(db, monthOf(period.start) < month ? monthOf(period.start) : month, month, userId),
  ]);
  const daily = everydayByDate(txns, period.start, period.end, fixed, { includePending: true });

  return computeAlerts({
    today,
    hour: manilaHour(now),
    prefs: { bills: p.notify_bills, spending: p.notify_spending },
    due,
    allowance:
      p.spending_limit_centavos !== null
        ? allowance(periodBudget(p.spending_limit_centavos, period), daily, daysBetween(period.start, today))
        : null,
    limits: limitStatuses(summarizeMonth(month, txns, fixed), settingMap, new Map(categories.data.map((c) => [c.id, c.name]))),
  });
}

/**
 * Sends alerts that are due and haven't gone out yet, to every user with a device subscribed (or just one).
 * Runs with the parse job (every 15 minutes) and right after a captured text is read.
 */
export async function runNotifications({ userId, now = new Date() }: { userId?: string; now?: Date } = {}) {
  if (!pushConfigured()) return { users: 0, sent: 0 };
  const db = createAdminClient();
  let query = db.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth");
  if (userId) query = query.eq("user_id", userId);
  const { data: subs, error } = await query;
  if (error) throw error;

  const byUser = new Map<string, PushTarget[]>();
  for (const s of subs) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);

  let sent = 0;
  for (const [uid, targets] of byUser) {
    try {
      const alerts = await alertsFor(db, uid, now);
      for (const alert of alerts) {
        // Claim it first: the primary key makes a second run (or a parallel one) skip it.
        const claim = await db.from("notification_log").insert({ user_id: uid, kind: alert.kind, ref: alert.ref }).select("ref");
        if (claim.error) continue;
        sent += await sendPush(db, targets, alert);
      }
    } catch (e) {
      console.error("notify: user failed", uid, e);
    }
  }
  return { users: byUser.size, sent };
}
