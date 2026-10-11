"use server";

import { getEmailSetupStatus, type EmailSetupStatus } from "@/lib/data/email-setup";

/** Polled by the setup wizard so steps tick over as Gmail's emails arrive. */
export async function pollEmailSetup(): Promise<EmailSetupStatus> {
  return getEmailSetupStatus();
}
