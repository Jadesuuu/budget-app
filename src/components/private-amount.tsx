import type { ReactNode } from "react";

/**
 * A balance the hide-balances toggle masks. Pure CSS on <html>, so toggling is instant and needs no request;
 * the mask is a pseudo-element, so the DOM (and copied text) only ever holds the real amount.
 */
export function Private({ children }: { children: ReactNode }) {
  return (
    <span className="private">
      <span className="private-value">{children}</span>
    </span>
  );
}
