import "server-only";
import { getSession } from "@/lib/auth";
import { readForwardingConfirmation } from "@/lib/email/gmail";
import { readMessage } from "@/lib/email/message";

export type EmailSetupStatus = {
  /**
   * Mailboxes that asked Gmail to forward here, newest first. Gmail used to send a code; now it sends a link
   * that the mailbox owner opens while signed in to that mailbox.
   */
  codes: { email: string; code: string | null; confirmUrl: string | null; receivedAt: string }[];
  /** Newest non-confirmation email that reached the Budget address, if any. */
  firstBankEmail: { subject: string | null; status: string } | null;
};

export async function getEmailSetupStatus(): Promise<EmailSetupStatus> {
  const { supabase } = await getSession();
  const [sources, emails] = await Promise.all([
    supabase
      .from("forwarding_sources")
      .select("email, confirmation_code, confirmation_received_at")
      .not("confirmation_received_at", "is", null)
      .order("confirmation_received_at", { ascending: false }),
    supabase
      .from("raw_emails")
      .select("subject, status, kind")
      .or("kind.is.null,kind.neq.gmail_confirmation")
      .order("received_at", { ascending: false })
      .limit(1),
  ]);
  if (sources.error) throw sources.error;
  if (emails.error) throw emails.error;
  const links = await confirmationLinks(supabase);
  return {
    codes: sources.data.map((s) => ({
      email: s.email,
      code: s.confirmation_code,
      confirmUrl: links.get(s.email) ?? null,
      receivedAt: s.confirmation_received_at ?? "",
    })),
    firstBankEmail: emails.data[0] ? { subject: emails.data[0].subject, status: emails.data[0].status } : null,
  };
}

/** The confirmation link is read from the stored email itself (only this user's, under RLS); newest wins. */
async function confirmationLinks(supabase: Awaited<ReturnType<typeof getSession>>["supabase"]): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("raw_emails")
    .select("raw_mime")
    .eq("kind", "gmail_confirmation")
    .order("received_at", { ascending: false })
    .limit(5);
  if (error) throw error;
  const links = new Map<string, string>();
  for (const row of data) {
    const confirmation = readForwardingConfirmation(await readMessage(row.raw_mime));
    if (confirmation?.confirmUrl && !links.has(confirmation.requestedBy)) links.set(confirmation.requestedBy, confirmation.confirmUrl);
  }
  return links;
}

/** Banks and e-wallets whose sender domains are known, so the Gmail filter can include them. */
export async function getFilterCoverage(): Promise<{ names: string[]; domains: string[] }> {
  const { supabase } = await getSession();
  const { data, error } = await supabase.from("institutions").select("name, email_domains").is("user_id", null).order("name");
  if (error) throw error;
  const covered = data.filter((i) => i.email_domains.length > 0);
  return { names: covered.map((i) => i.name), domains: covered.flatMap((i) => i.email_domains) };
}
