"use server";

import { userDataChanged } from "@/lib/user-data";
import { z } from "zod";
import { requireUser } from "@/lib/auth";

export type ActionResult = { ok: true } | { ok: false; message: string };

const id = z.uuid();
const failed = (message: string): ActionResult => ({ ok: false, message });

/** On success, expires every cached page so balances and counts elsewhere are current. */
function settled(error: unknown, message: string): ActionResult {
  if (error) return failed(message);
  userDataChanged();
  return { ok: true };
}

export async function confirmTransaction(input: { id: string; categoryId: string | null }): Promise<ActionResult> {
  const parsed = z.object({ id, categoryId: id.nullable() }).safeParse(input);
  if (!parsed.success) return failed("That transaction couldn't be found.");
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("confirm_transaction", {
    p_id: parsed.data.id,
    p_category_id: parsed.data.categoryId ?? undefined,
  });
  return settled(error, "Couldn't confirm. It may have been reviewed already.");
}

export async function ignoreTransaction(input: { id: string }): Promise<ActionResult> {
  const parsed = z.object({ id }).safeParse(input);
  if (!parsed.success) return failed("That transaction couldn't be found.");
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("ignore_transaction", { p_id: parsed.data.id });
  return settled(error, "Couldn't ignore. It may have been reviewed already.");
}

export async function reopenTransaction(input: { id: string }): Promise<ActionResult> {
  const parsed = z.object({ id }).safeParse(input);
  if (!parsed.success) return failed("That transaction couldn't be found.");
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("reopen_transaction", { p_id: parsed.data.id });
  return settled(error, "Couldn't undo that one.");
}

export async function markNotDuplicate(input: { id: string }): Promise<ActionResult> {
  const parsed = z.object({ id }).safeParse(input);
  if (!parsed.success) return failed("That transaction couldn't be found.");
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("mark_not_duplicate", { p_id: parsed.data.id });
  return settled(error, "Couldn't update the duplicate warning.");
}

export async function confirmAsTransfer(input: { outId: string; inId: string }): Promise<ActionResult> {
  const parsed = z.object({ outId: id, inId: id }).safeParse(input);
  if (!parsed.success) return failed("Those transactions couldn't be found.");
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("confirm_as_transfer", { p_out_id: parsed.data.outId, p_in_id: parsed.data.inId });
  return settled(error, "Couldn't record the transfer. Review them one at a time instead.");
}

export async function confirmOneSidedTransfer(input: { id: string; otherAccountId: string }): Promise<ActionResult> {
  const parsed = z.object({ id, otherAccountId: id }).safeParse(input);
  if (!parsed.success) return failed("Pick the other account for this transfer.");
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("confirm_one_sided_transfer", {
    p_id: parsed.data.id,
    p_other_account: parsed.data.otherAccountId,
  });
  return settled(error, "Couldn't record the transfer.");
}
