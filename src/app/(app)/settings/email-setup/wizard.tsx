"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Download, ExternalLink, LoaderCircle, TriangleAlert } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import type { EmailSetupStatus } from "@/lib/data/email-setup";
import { pollEmailSetup } from "./actions";

const GMAIL_FORWARDING = "https://mail.google.com/mail/u/0/#settings/fwdandpop";
const GMAIL_FILTERS = "https://mail.google.com/mail/u/0/#settings/filters";
const POLL_MS = 5000;

type Props = { address: string; initial: EmailSetupStatus; coverage: string[] };

export function EmailSetupWizard({ address, initial, coverage }: Props) {
  const [status, setStatus] = useState(initial);
  const latestCode = status.codes[0] ?? null;
  const done = Boolean(latestCode && status.firstBankEmail);

  useEffect(() => {
    if (done) return;
    const timer = setInterval(async () => {
      try {
        setStatus(await pollEmailSetup());
      } catch {
        // Offline or signed out: keep the last known state and try again next tick.
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [done]);

  return (
    <ol className="wizard">
      <Step n={1} title="Add your Budget address in Gmail" complete={Boolean(latestCode)}>
        <p>Open Gmail&apos;s forwarding settings, choose <b>Add a forwarding address</b>, and paste this:</p>
        <div className="alias-box">
          <code>{address}</code>
          <CopyButton value={address} label="Copy" />
        </div>
        <a className="btn" href={GMAIL_FORWARDING} target="_blank" rel="noreferrer">
          <ExternalLink aria-hidden />
          Open Gmail forwarding settings
        </a>
        <p className="hint">
          On a phone, Gmail&apos;s app doesn&apos;t have these settings. Open gmail.com in your browser and switch on Desktop
          site in the browser menu.
        </p>
      </Step>

      <Step n={2} title="Copy the confirmation code into Gmail" complete={Boolean(latestCode)}>
        {latestCode ? (
          <>
            <p>
              Gmail sent this code for <b>{latestCode.email}</b>. Paste it in Gmail and click <b>Verify</b>.
            </p>
            <div className="big-code">
              <code>{latestCode.code}</code>
              <CopyButton value={latestCode.code} label="Copy code" />
            </div>
          </>
        ) : (
          <p className="waiting" role="status">
            <LoaderCircle aria-hidden className="spin" />
            Waiting for Gmail&apos;s code. It appears here by itself a few seconds after you add the address.
          </p>
        )}
        <div className="warning-box" role="note">
          <TriangleAlert aria-hidden />
          <p>
            After verifying, leave <b>Disable forwarding</b> selected. Don&apos;t choose <b>Forward a copy of incoming mail</b>:
            that would send all your email. The filter in the next step forwards only bank emails.
          </p>
        </div>
      </Step>

      <Step n={3} title="Import the bank filter" complete={coverage.length > 0 && Boolean(status.firstBankEmail)}>
        {coverage.length > 0 ? (
          <>
            <p>This filter forwards emails from these senders only: {coverage.join(", ")}.</p>
            <a className="btn primary" href="/settings/email-setup/filter" download>
              <Download aria-hidden />
              Download your filter
            </a>
            <ol className="steps">
              <li>
                In Gmail, open{" "}
                <a href={GMAIL_FILTERS} target="_blank" rel="noreferrer">
                  Filters and Blocked Addresses
                </a>
                .
              </li>
              <li>Click Import filters, choose the file you downloaded, then Open file.</li>
              <li>Tick the filter and click Create filters.</li>
            </ol>
          </>
        ) : (
          <p className="hint">
            Not ready yet: your banks&apos; sender addresses are still being added. Come back to this step once they are,
            or add transactions by hand in the meantime.
          </p>
        )}
      </Step>

      <Step n={4} title="Wait for your first bank email" complete={Boolean(status.firstBankEmail)}>
        {status.firstBankEmail ? (
          <p>
            Got it: <b>{status.firstBankEmail.subject || "a bank email"}</b>.{" "}
            <Link href="/settings/emails">See what happened to it</Link>.
          </p>
        ) : (
          <p className="waiting" role="status">
            <LoaderCircle aria-hidden className="spin" />
            Waiting. The next time your bank emails you, it shows up here and in Review.
          </p>
        )}
      </Step>
    </ol>
  );
}

function Step({ n, title, complete, children }: { n: number; title: string; complete: boolean; children: React.ReactNode }) {
  return (
    <li className={complete ? "wizard-step complete" : "wizard-step"}>
      <div className="wizard-marker" aria-hidden>
        {complete ? <Check /> : n}
      </div>
      <div className="wizard-body">
        <h2>
          {title}
          {complete && <span className="vh"> (done)</span>}
        </h2>
        {children}
      </div>
    </li>
  );
}
