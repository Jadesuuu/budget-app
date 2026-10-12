"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const POLL_MS = 20_000;

/**
 * Pages are prefetched and kept for a few minutes so taps feel instant, but texts and emails keep arriving in
 * the background. So the current page is refetched every time the app comes back to the screen, and while it's
 * open a tiny check (`/api/changes`) runs every 20 seconds, refetching only when something actually changed.
 */
export function RefreshOnReturn() {
  const router = useRouter();
  useEffect(() => {
    let known: string | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;

    async function check() {
      try {
        const res = await fetch("/api/changes", { cache: "no-store" });
        if (!res.ok) return;
        const { version } = (await res.json()) as { version: string };
        if (known !== null && version !== known) router.refresh();
        known = version;
      } catch {
        // Offline or asleep: try again on the next tick.
      }
    }
    function start() {
      clearInterval(timer);
      timer = setInterval(check, POLL_MS);
    }
    function onChange() {
      if (document.visibilityState === "hidden") {
        clearInterval(timer);
        return;
      }
      router.refresh();
      known = null;
      void check();
      start();
    }

    void check();
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onChange);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onChange);
    };
  }, [router]);
  return null;
}
