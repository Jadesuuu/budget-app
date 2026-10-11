import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CircleAlert, CircleCheck, Clock, Info, KeyRound, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { addDays, todayInManila } from "@/lib/dates";
import { describeWhen } from "@/lib/inbox";
import { retryEmail } from "../email-actions";

export const metadata: Metadata = { title: "Recent emails" };

const STATUS = {
  pending: { label: "Waiting to be read", icon: Clock, tone: "muted" },
  parsed: { label: "Added to Review", icon: CircleCheck, tone: "ok" },
  flagged: { label: "Held back", icon: ShieldAlert, tone: "warn" },
  failed: { label: "Not read", icon: CircleAlert, tone: "warn" },
} as const;

export default function EmailsPage() {
  return (
    <>
      <PageHeader title="Recent emails" />
      <p className="settings-p">
        Every email that reached your Budget address in the last 30 days, and what happened to it. Only emails you
        forwarded show up here.
      </p>
      <Suspense fallback={<div className="skeleton" style={{ height: 240 }} aria-busy="true" />}>
        <EmailList />
      </Suspense>
      <Link href="/settings#forwarding" className="link-btn">Back to email forwarding</Link>
    </>
  );
}

async function EmailList() {
  const { supabase } = await requireUser();
  const since = addDays(todayInManila(), -30);
  const { data, error } = await supabase
    .from("raw_emails")
    .select("id, subject, from_address, original_from, received_at, status, kind, note")
    .gte("received_at", since)
    .order("received_at", { ascending: false })
    .limit(100);
  if (error) throw error;

  if (data.length === 0) {
    return (
      <div className="empty">
        <h2>No emails yet</h2>
        <p>Once Gmail forwards your first bank email, it shows up here within a minute.</p>
      </div>
    );
  }

  return (
    <ul className="row-list email-list">
      {data.map((e) => {
        // Parsed but not a transaction (statements, reminders) reads as "Noted", not "Added to Review".
        const noted = e.status === "parsed" && e.kind === "other";
        const status = noted ? { label: "Noted", icon: Info, tone: "muted" as const } : STATUS[e.status];
        const Icon = e.kind === "gmail_confirmation" ? KeyRound : status.icon;
        return (
          <li key={e.id} className="email-row">
            <Icon aria-hidden className={`email-icon ${status.tone}`} />
            <div className="email-main">
              <p className="row-title">{e.subject || "(no subject)"}</p>
              <p className="row-sub">
                {e.original_from ?? e.from_address}, {describeWhen(e.received_at)}
              </p>
              <p className={`email-status ${status.tone}`}>
                {e.kind === "gmail_confirmation" ? "Gmail confirmation code saved" : status.label}
                {e.note && e.kind !== "gmail_confirmation" ? `. ${e.note}` : ""}
              </p>
            </div>
            {(e.status === "failed" || e.status === "flagged") && (
              <form action={retryEmail}>
                <input type="hidden" name="id" value={e.id} />
                <button className="mini-btn" type="submit">Try again</button>
              </form>
            )}
          </li>
        );
      })}
    </ul>
  );
}
