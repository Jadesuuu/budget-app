import type { Metadata } from "next";
import { Suspense } from "react";
import { CircleAlert, CircleCheck, Clock, Info, MessageSquareText, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { addDays, todayInManila } from "@/lib/dates";
import { describeWhen } from "@/lib/inbox";
import { revokeCaptureLink } from "./actions";
import { CreateLinkForm } from "./create-link";

export const metadata: Metadata = { title: "Phone capture" };

const STATUS = {
  pending: { label: "Waiting to be read", icon: Clock, tone: "muted" },
  parsed: { label: "Added to Review", icon: CircleCheck, tone: "ok" },
  flagged: { label: "Ignored", icon: ShieldAlert, tone: "muted" },
  failed: { label: "Not read", icon: CircleAlert, tone: "warn" },
} as const;

export default function PhoneCapturePage() {
  return (
    <>
      <PageHeader title="Phone capture" />
      <p className="settings-p">
        Your phone sends bank texts and app notifications to Budget, and each one becomes a card in Review. Texts and
        chats from anyone who isn&apos;t a bank are dropped without keeping what they said.
      </p>
      <p className="hint">
        Phones can only reach Budget once it&apos;s online at budget.jadebonifacio.dev. Until then, links created here
        work only on this computer.
      </p>

      <Suspense fallback={<div className="skeleton" style={{ height: 200 }} aria-busy="true" />}>
        <Links />
      </Suspense>

      <section className="settings-sec" aria-labelledby="android-h">
        <h2 id="android-h" className="settings-h">On Android</h2>
        <p className="settings-p">Captures bank texts and notifications from apps like GCash, Maya, Shopee, TikTok and Viber.</p>
        <ol className="steps">
          <li>Install <b>Message487</b> from F-Droid. (For texts only, <b>SMS to URL Forwarder</b> also works.)</li>
          <li>Add a webhook: paste your capture link as the URL and choose POST.</li>
          <li>Choose what to forward: texts from your banks, and notifications from your bank and e-wallet apps. For Viber, Budget keeps only chats whose name is a known bank.</li>
          <li>Allow notification and SMS access when Android asks.</li>
        </ol>
        <p className="hint">Menu names can differ a little between app versions.</p>
      </section>

      <section className="settings-sec" aria-labelledby="iphone-h">
        <h2 id="iphone-h" className="settings-h">On iPhone</h2>
        <p className="settings-p">
          Captures bank texts. iPhones don&apos;t let any app read other apps&apos; notifications, so GCash and other app alerts
          can&apos;t be captured. Add those by hand for now; a monthly GCash history import is planned.
        </p>
        <ol className="steps">
          <li>Open Shortcuts, go to Automation, tap New Automation, then Message.</li>
          <li>Under Message Contains, type a word your bank always uses, like BPI. Choose Run Immediately, then Next.</li>
          <li>Pick New Blank Automation and add the action Get Contents of URL. Paste your capture link.</li>
          <li>Tap Show More: set Method to POST and Request Body to JSON. Add three text fields: channel = sms, sender = Sender, text = Content (pick Sender and Content from Shortcut Input).</li>
          <li>Tap Done. Repeat for each bank.</li>
        </ol>
        <p className="hint">Needs iOS 17 or later. If a personal text mentions your bank, Budget drops it because it isn&apos;t from the bank.</p>
      </section>

      <Suspense fallback={null}>
        <RecentMessages />
      </Suspense>
    </>
  );
}

async function Links() {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("capture_links")
    .select("id, label, created_at, last_used_at, revoked_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const active = data.filter((l) => !l.revoked_at);

  return (
    <section className="settings-sec" aria-labelledby="links-h">
      <h2 id="links-h" className="settings-h">Your capture links</h2>
      {active.length > 0 && (
        <ul className="row-list">
          {active.map((l) => (
            <li key={l.id} className="row">
              <div>
                <p className="row-title">{l.label}</p>
                <p className="row-sub">
                  {l.last_used_at ? `Last message ${describeWhen(l.last_used_at)}` : "No messages yet"}
                </p>
              </div>
              <form action={revokeCaptureLink}>
                <input type="hidden" name="id" value={l.id} />
                <button className="mini-btn" type="submit" aria-label={`Revoke ${l.label}`}>Revoke</button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <CreateLinkForm />
    </section>
  );
}

async function RecentMessages() {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("raw_messages")
    .select("id, channel, sender, title, body, received_at, status, note")
    .gte("received_at", addDays(todayInManila(), -30))
    .order("received_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  if (data.length === 0) return null;

  return (
    <section className="settings-sec" aria-labelledby="recent-h">
      <h2 id="recent-h" className="settings-h">Recently captured</h2>
      <ul className="row-list email-list">
        {data.map((m) => {
          // Parsed with a note = recognised but not a transaction (e.g. a due reminder).
          const status = m.status === "parsed" && m.note ? { label: "Noted", icon: Info, tone: "muted" as const } : STATUS[m.status];
          const Icon = m.status === "parsed" ? status.icon : m.body ? MessageSquareText : status.icon;
          const from = m.channel === "notification" && m.title ? `${m.title} (${m.sender})` : m.sender;
          return (
            <li key={m.id} className="email-row">
              <Icon aria-hidden className={`email-icon ${status.tone}`} />
              <div className="email-main">
                <p className="row-title">{from}</p>
                <p className="row-sub">{describeWhen(m.received_at)}{m.body ? `: ${m.body.slice(0, 80)}` : ""}</p>
                <p className={`email-status ${status.tone}`}>
                  {status.label}
                  {m.note ? `. ${m.note}` : ""}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
