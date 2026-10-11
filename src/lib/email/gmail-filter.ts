/**
 * Builds a Gmail filter file (Settings -> Filters and Blocked Addresses -> Import filters) that forwards
 * only emails from known bank and e-wallet sender domains to the user's Budget address.
 * Format: the Atom feed Gmail itself exports for filters.
 */
export function buildGmailFilterXml(options: { forwardTo: string; domains: string[]; now?: Date }): string {
  const domains = [...new Set(options.domains.map((d) => d.trim().toLowerCase()).filter(isDomain))].sort();
  if (domains.length === 0) throw new Error("No sender domains to filter on");
  if (!/^[a-z0-9_.+-]+@[a-z0-9.-]+$/.test(options.forwardTo)) throw new Error("Invalid forwarding address");
  const updated = (options.now ?? new Date()).toISOString().replace(/\.\d{3}Z$/, "Z");

  return `<?xml version='1.0' encoding='UTF-8'?>
<feed xmlns='http://www.w3.org/2005/Atom' xmlns:apps='http://schemas.google.com/apps/2006'>
  <title>Mail Filters</title>
  <id>tag:mail.google.com,2008:filters:budget</id>
  <updated>${updated}</updated>
  <author><name>Budget</name></author>
  <entry>
    <category term='filter'></category>
    <title>Mail Filter</title>
    <id>tag:mail.google.com,2008:filter:budget-banks</id>
    <updated>${updated}</updated>
    <content></content>
    <apps:property name='from' value='${escapeXml(domains.join(" OR "))}'/>
    <apps:property name='forwardTo' value='${escapeXml(options.forwardTo)}'/>
    <apps:property name='sizeOperator' value='s_sl'/>
    <apps:property name='sizeUnit' value='s_smb'/>
  </entry>
</feed>
`;
}

function isDomain(value: string): boolean {
  return /^(?=.{3,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/.test(value);
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/'/g, "&apos;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
