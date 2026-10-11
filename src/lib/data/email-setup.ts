import "server-only";
import { getSession } from "@/lib/auth";

export type EmailSetupStatus = {
  /** Mailboxes that sent a Gmail confirmation code, newest first. */
  codes: { email: string; code: string; receivedAt: string }[];
  /** Newest non-confirmation email that reached the Budget address, if any. */
  firstBankEmail: { subject: string | null; status: string } | null;
};

export async function getEmailSetupStatus(): Promise<EmailSetupStatus> {
  const { supabase } = await getSession();
  const [sources, emails] = await Promise.all([
    supabase
      .from("forwarding_sources")
      .select("email, confirmation_code, confirmation_received_at")
      .not("confirmation_code", "is", null)
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
  return {
    codes: sources.data.map((s) => ({ email: s.email, code: s.confirmation_code ?? "", receivedAt: s.confirmation_received_at ?? "" })),
    firstBankEmail: emails.data[0] ? { subject: emails.data[0].subject, status: emails.data[0].status } : null,
  };
}

/** Banks and e-wallets whose sender domains are known, so the Gmail filter can include them. */
export async function getFilterCoverage(): Promise<{ names: string[]; domains: string[] }> {
  const { supabase } = await getSession();
  const { data, error } = await supabase.from("institutions").select("name, email_domains").is("user_id", null).order("name");
  if (error) throw error;
  const covered = data.filter((i) => i.email_domains.length > 0);
  return { names: covered.map((i) => i.name), domains: covered.flatMap((i) => i.email_domains) };
}
