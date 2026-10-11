"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const AWAY_MS = 60_000;

/**
 * Pages are prefetched and kept for a few minutes so taps feel instant. Texts and emails keep arriving in the
 * background, so coming back to the app after a minute away fetches the current page and drops the rest.
 */
export function RefreshOnReturn() {
  const router = useRouter();
  useEffect(() => {
    let hiddenAt = 0;
    function onChange() {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > AWAY_MS) router.refresh();
    }
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, [router]);
  return null;
}
