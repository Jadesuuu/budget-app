import type { Metadata } from "next";
import { Suspense } from "react";
import { CopyButton } from "@/components/copy-button";
import { PageHeader } from "@/components/page-header";
import { getProfile } from "@/lib/auth";
import { env } from "@/lib/env";
import { modeSchema, themeIdSchema, DEFAULT_MODE, DEFAULT_THEME } from "@/lib/themes";
import { signOut } from "./actions";
import { AppearanceForm } from "./appearance-form";
import { NameForm } from "./name-form";

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
        <div className="alias-box">
          <code>{address}</code>
          <CopyButton value={address} label="Copy address" />
        </div>
        <ol className="steps">
          <li>In Gmail, open Settings, then Forwarding and POP/IMAP, then Add a forwarding address. Paste the address above.</li>
          <li>Gmail sends a confirmation code to Budget. It appears below within a minute.</li>
          <li>Create a Gmail filter for your banks&apos; sender addresses and choose Forward it to this address.</li>
        </ol>
        <div className="code-box" aria-live="polite">
          {profile.gmail_forward_code ? (
            <>
              <span className="code-label">Gmail confirmation code</span>
              <code className="code-value">{profile.gmail_forward_code}</code>
            </>
          ) : (
            <span className="code-label">No confirmation code yet. Email capture switches on in an upcoming update.</span>
          )}
        </div>
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
