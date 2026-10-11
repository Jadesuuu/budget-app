import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CopyButton } from "@/components/copy-button";
import { PageHeader } from "@/components/page-header";
import { getProfile, requireUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { modeSchema, themeIdSchema, DEFAULT_MODE, DEFAULT_THEME } from "@/lib/themes";
import { signOut } from "./actions";
import { AppearanceForm } from "./appearance-form";
import { removeForwardingSource } from "./email-actions";
import { NameForm } from "./name-form";
import { SourceForm } from "./source-form";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" />
      <Suspense fallback={<div className="skeleton" style={{ height: 320 }} aria-busy="true" />}>
        <SettingsContent />
      </Suspense>
    </>
  );
}

async function SettingsContent() {
  const profile = await getProfile();
  const { supabase } = await requireUser();
  const { data: sources, error } = await supabase
    .from("forwarding_sources")
    .select("id, email, added_by, confirmation_code")
    .order("created_at");
  if (error) throw error;
  const address = `${profile.inbound_alias}@${env.INBOUND_EMAIL_DOMAIN}`;
  const theme = themeIdSchema.catch(DEFAULT_THEME).parse(profile.theme);
  const mode = modeSchema.catch(DEFAULT_MODE).parse(profile.mode);

  return (
    <>
      <section className="settings-sec" aria-labelledby="appearance-h">
        <h2 id="appearance-h" className="settings-h">Theme</h2>
        <AppearanceForm initialTheme={theme} initialMode={mode} />
      </section>

      <section className="settings-sec" id="forwarding" aria-labelledby="forwarding-h">
        <h2 id="forwarding-h" className="settings-h">Email forwarding</h2>
        <p className="settings-p">
          Forward bank and e-wallet emails to this address and they show up in Review. Budget only sees what you
          forward.
        </p>
        <Link href="/settings/email-setup" className="btn primary">
          Set up with a guide
        </Link>
        <div className="alias-box">
          <code>{address}</code>
          <CopyButton value={address} label="Copy address" />
        </div>
        <ol className="steps">
          <li>In Gmail, open Settings, then Forwarding and POP/IMAP, then Add a forwarding address. Paste the address above.</li>
          <li>Gmail sends a confirmation code to Budget. It appears next to that mailbox below within a minute.</li>
          <li>Create a Gmail filter for your banks&apos; sender addresses and choose Forward it to this address.</li>
        </ol>

        <h3 className="settings-sub">Your mailboxes</h3>
        <p className="settings-p">Forwards from addresses not on this list are held back, so no one else can add transactions for you.</p>
        <ul className="row-list source-list">
          {sources.map((s) => (
            <li key={s.id} className="row">
              <div>
                <p className="row-title">{s.email}</p>
                <p className="row-sub">
                  {s.added_by === "account" ? "Your sign-in address" : s.added_by === "gmail_confirmation" ? "Added by Gmail confirmation" : "Added by you"}
                </p>
              </div>
              {s.confirmation_code ? (
                <div className="source-code">
                  <span className="code-label">Gmail code</span>
                  <code className="code-value">{s.confirmation_code}</code>
                </div>
              ) : s.added_by !== "account" ? (
                <form action={removeForwardingSource}>
                  <input type="hidden" name="id" value={s.id} />
                  <button className="mini-btn" type="submit" aria-label={`Remove ${s.email}`}>Remove</button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
        <SourceForm />
        <Link href="/settings/emails" className="btn">
          See recent emails
        </Link>
      </section>

      <section className="settings-sec" aria-labelledby="profile-h">
        <h2 id="profile-h" className="settings-h">Profile</h2>
        <NameForm initialName={profile.display_name ?? ""} />
        <p className="settings-p">Signed in as {profile.email}</p>
        <form action={signOut}>
          <button className="btn" type="submit">
            Sign out
          </button>
        </form>
      </section>
    </>
  );
}
