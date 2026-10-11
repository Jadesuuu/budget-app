/**
 * For Gmail accounts that can't add a forwarding address (no "Add a forwarding address" button): a Google Apps
 * Script the user runs in their own account. Every 10 minutes it forwards new emails from known bank senders to
 * their Budget address. Budget reads these like hand-forwarded emails (the original sender is in the
 * "Forwarded message" block), so the mailbox must be listed under Settings, Email forwarding.
 */
export function buildForwardingScript({ forwardTo, domains }: { forwardTo: string; domains: string[] }): string {
  if (!/^u_[a-z0-9]{10}@[a-z0-9.-]+$/.test(forwardTo)) throw new Error("Not a Budget address");
  const senders = [...new Set(domains.map((d) => d.trim().toLowerCase()).filter((d) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)))].sort();
  if (senders.length === 0) throw new Error("No bank sender domains yet");

  return `// Budget: forwards bank and e-wallet emails from this Gmail to your Budget address.
// Only emails from the senders below are forwarded; nothing else is read or sent.
// Setup: paste this at script.google.com (New project), click Run with "setup" selected, and allow access.

const BUDGET_ADDRESS = ${JSON.stringify(forwardTo)};
const BANK_SENDERS = ${JSON.stringify(senders)};
const LABEL = "Sent to Budget";

function setup() {
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("forwardBankEmails").timeBased().everyMinutes(10).create();
  // First run covers the last 2 days, so recent bank emails show up in Review right away.
  PropertiesService.getScriptProperties().setProperty("lastRun", String(Date.now() - 2 * 24 * 60 * 60 * 1000));
  forwardBankEmails();
}

function forwardBankEmails() {
  const props = PropertiesService.getScriptProperties();
  const since = Number(props.getProperty("lastRun") || Date.now() - 60 * 60 * 1000);
  const startedAt = Date.now();
  const label = GmailApp.getUserLabelByName(LABEL) || GmailApp.createLabel(LABEL);
  const query = "from:(" + BANK_SENDERS.join(" OR ") + ") after:" + Math.floor(since / 1000 - 600);

  for (const thread of GmailApp.search(query, 0, 100)) {
    let forwarded = false;
    for (const message of thread.getMessages()) {
      if (message.getDate().getTime() <= since) continue;
      const from = message.getFrom().toLowerCase();
      if (!BANK_SENDERS.some((domain) => from.includes("@" + domain) || from.includes("." + domain))) continue;
      message.forward(BUDGET_ADDRESS);
      forwarded = true;
    }
    if (forwarded) thread.addLabel(label);
  }
  props.setProperty("lastRun", String(startedAt));
}
`;
}
