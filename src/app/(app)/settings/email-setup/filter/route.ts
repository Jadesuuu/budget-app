import { getProfile } from "@/lib/auth";
import { getFilterCoverage } from "@/lib/data/email-setup";
import { buildGmailFilterXml } from "@/lib/email/gmail-filter";
import { env } from "@/lib/env";

/** Personal Gmail filter file: forwards only known bank/e-wallet senders to this user's Budget address. */
export async function GET() {
  const profile = await getProfile();
  const { domains } = await getFilterCoverage();
  if (domains.length === 0) {
    return new Response("No bank sender addresses are known yet.", { status: 409 });
  }
  const xml = buildGmailFilterXml({ forwardTo: `${profile.inbound_alias}@${env.INBOUND_EMAIL_DOMAIN}`, domains });
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": 'attachment; filename="budget-gmail-filter.xml"',
      "Cache-Control": "no-store",
    },
  });
}
