import "server-only";
import { cacheTag, updateTag } from "next/cache";

const TAG = "user-data";

/**
 * Pages cache the signed-in user's data with "use cache: private" (kept in that browser only, never on the
 * server) so the router can prefetch it and taps feel instant. Call this first inside each such scope.
 */
export function cachedUserData() {
  cacheTag(TAG);
}

/** Call from a Server Action after any write: expires every private cache, so no page shows old data. */
export function userDataChanged() {
  updateTag(TAG);
}
