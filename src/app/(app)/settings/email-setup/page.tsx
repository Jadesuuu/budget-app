import type { Metadata } from "next";
import { cachedUserData } from "@/lib/user-data";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { getProfile } from "@/lib/auth";
import { getEmailSetupStatus, getFilterCoverage } from "@/lib/data/email-setup";
import { buildForwardingScript } from "@/lib/email/apps-script";
import { env } from "@/lib/env";
import { EmailSetupWizard } from "./wizard";

export const metadata: Metadata = { title: "Set up email" };

export default function EmailSetupPage() {
  return (
    <>
      <PageHeader title="Set up email" />
      <p className="settings-p">
        About three minutes, once. Afterwards, bank and e-wallet emails turn into transactions for you to confirm. Budget
        only receives the emails your filter forwards; the rest of your Gmail stays private.
      </p>
      <Suspense fallback={<div className="skeleton" style={{ height: 480 }} aria-busy="true" />}>
        <Wizard />
      </Suspense>
    </>
  );
}

async function Wizard() {
  "use cache: private";
  cachedUserData();
  const [profile, status, coverage] = await Promise.all([getProfile(), getEmailSetupStatus(), getFilterCoverage()]);
  const address = `${profile.inbound_alias}@${env.INBOUND_EMAIL_DOMAIN}`;
  return (
    <EmailSetupWizard
      address={address}
      initial={status}
      coverage={coverage.names}
      script={coverage.domains.length > 0 ? buildForwardingScript({ forwardTo: address, domains: coverage.domains }) : null}
    />
  );
}
