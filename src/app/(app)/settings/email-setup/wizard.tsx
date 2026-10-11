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

type Props = { address: string; initial: EmailSetupStatus; coverage: string[]; script: string | null };

export function EmailSetupWizard({ address, initial, coverage, script }: Props) {
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
          The button opens the first Google account signed in on this browser. If that&apos;s not the mailbox your bank
          emails go to, switch accounts from the profile picture in Gmail first. Gmail&apos;s app doesn&apos;t have these
          settings; use a computer, or gmail.com with Desktop site switched on.
        </p>
        {script && <NoForwardingButton script={script} />}
      </Step>

      <Step n={2} title="Confirm it for Gmail" complete={Boolean(latestCode)}>
        {latestCode?.confirmUrl ? (
          <>
            <p>
              Gmail asked Budget to confirm forwarding from <b>{latestCode.email}</b>. Open this while signed in to{" "}
              <b>{latestCode.email}</b> (a private window signed in to only that account is safest), then click{" "}
              <b>Confirm</b> if Gmail asks.
            </p>
            <a className="btn primary confirm-link" href={latestCode.confirmUrl} target="_blank" rel="noreferrer">
              <ExternalLink aria-hidden />
              Confirm in Gmail
            </a>
            <div className="alias-box">
              <code className="confirm-url">{latestCode.confirmUrl}</code>
              <CopyButton value={latestCode.confirmUrl} label="Copy link" />
            </div>
          </>
        ) : latestCode?.code ? (
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
            Waiting for Gmail. Its confirmation appears here by itself a few seconds after you add the address.
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

/** Some Gmail accounts don't offer "Add a forwarding address" at all; a script in their own account does the same job. */
function NoForwardingButton({ script }: { script: string }) {
  return (
    <details className="edit-details no-fwd">
      <summary>No &quot;Add a forwarding address&quot; button in Gmail?</summary>
      <p>
        Some Gmail accounts don&apos;t offer it. Use this small script instead: it runs in your own Google account every
        10 minutes and forwards only emails from your banks to Budget. Then skip the other steps on this page.
      </p>
      <ol className="steps">
        <li>
          On a computer, open{" "}
          <a href="https://script.google.com/home/projects/create" target="_blank" rel="noreferrer">
            script.google.com
          </a>{" "}
          signed in to the Gmail your bank emails go to. A new project opens.
        </li>
        <li>Delete what&apos;s in the editor, then paste the script (Copy script below).</li>
        <li>Click Save, choose <b>setup</b> in the function menu at the top, and click <b>Run</b>.</li>
        <li>
          Allow access. Google warns that it hasn&apos;t verified the app, because you wrote it: click <b>Advanced</b>, then{" "}
          <b>Go to (project name)</b>, then <b>Allow</b>.
        </li>
        <li>
          In Budget, Settings, Email forwarding: add that Gmail address if it isn&apos;t listed, so Budget trusts what it forwards.
        </li>
      </ol>
      <CopyButton value={script} label="Copy script" />
      <pre className="script-preview">
        <code>{script}</code>
      </pre>
    </details>
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
