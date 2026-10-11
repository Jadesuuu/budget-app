import "server-only";
import { headers } from "next/headers";

/**
 * This deployment's own origin, for links Budget hands out (sign-in emails, phone capture links). Taken from the
 * request, so it is the real site in production and localhost only when the app itself runs on localhost.
 */
export async function siteOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) throw new Error("Can't tell this site's address from the request.");
  const proto = h.get("x-forwarded-proto") ?? (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}
