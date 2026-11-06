"use server";

import { redirect } from "next/navigation";
import { DEMO } from "@/lib/demo/mode";
import { userDataChanged } from "@/lib/user-data";

/** Demo build only: drops this visitor's changes and goes back to the seeded data. */
export async function resetDemoAction() {
  if (!DEMO) return;
  await (await import("@/lib/demo/store")).resetDemo();
  userDataChanged();
  redirect("/");
}
