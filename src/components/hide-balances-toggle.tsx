"use client";

import { useSyncExternalStore } from "react";
import { Eye, EyeOff } from "lucide-react";
import { HIDE_ATTR, HIDE_COOKIE } from "@/lib/privacy";

const YEAR = 60 * 60 * 24 * 365;

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: [HIDE_ATTR] });
  return () => observer.disconnect();
}
const isHidden = () => document.documentElement.hasAttribute(HIDE_ATTR);

/** Eye button: hides every balance on every page at once, and remembers it on this device. */
export function HideBalancesToggle() {
  const hidden = useSyncExternalStore(subscribe, isHidden, () => false);

  function toggle() {
    document.documentElement.toggleAttribute(HIDE_ATTR, !hidden);
    document.cookie = `${HIDE_COOKIE}=${hidden ? "off" : "on"}; path=/; max-age=${YEAR}; samesite=lax`;
  }

  return (
    <button type="button" className="icon-btn" aria-label="Hide balances" aria-pressed={hidden} onClick={toggle}>
      {hidden ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
    </button>
  );
}
