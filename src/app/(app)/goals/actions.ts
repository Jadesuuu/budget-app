"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { parsePesoInput } from "@/lib/money-input";
import { userDataChanged } from "@/lib/user-data";

export type GoalState = { status: "idle" | "saved" } | { status: "error"; message: string };

const goalSchema = z.object({
  id: z.union([z.uuid(), z.literal("")]).optional(),
  name: z.string().trim().min(1, "Give the goal a name.").max(80, "Keep the name under 80 characters."),
  target: z.string().trim(),
  targetDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]),
  account: z.union([z.uuid(), z.literal("")]).default(""),
});

export async function saveGoal(_prev: GoalState, formData: FormData): Promise<GoalState> {
  const parsed = goalSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message };
  const target = parsePesoInput(parsed.data.target);
  if (target === null) return { status: "error", message: "Enter the target as an amount, like 50,000." };

  const { supabase } = await requireUser();
  const row = {
    name: parsed.data.name,
    target_centavos: target,
    target_date: parsed.data.targetDate || null,
    account_id: parsed.data.account || null,
  };
  const { error } = parsed.data.id
    ? await supabase.from("savings_goals").update(row).eq("id", parsed.data.id)
    : await supabase.from("savings_goals").insert(row);
  if (error?.code === "23514") return { status: "error", message: "Pick a savings, debit or e-wallet account." };
  if (error) return { status: "error", message: "Couldn't save the goal. Try again." };
  userDataChanged();
  return { status: "saved" };
}

const moveSchema = z.object({ id: z.uuid(), amount: z.string().trim(), direction: z.enum(["in", "out"]) });

/** Put money into a goal or take it out. */
export async function moveGoalMoney(_prev: GoalState, formData: FormData): Promise<GoalState> {
  const parsed = moveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Something went wrong. Reload and try again." };
  const amount = parsePesoInput(parsed.data.amount);
  if (amount === null) return { status: "error", message: "Enter an amount, like 1,000." };

  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("add_to_goal", {
    p_id: parsed.data.id,
    p_amount_centavos: parsed.data.direction === "in" ? amount : -amount,
  });
  if (error?.code === "23514") return { status: "error", message: "That's more than this goal has saved." };
  if (error || data === null) return { status: "error", message: "Couldn't update the goal. Try again." };
  userDataChanged();
  return { status: "saved" };
}

export async function archiveGoal(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const { supabase } = await requireUser();
  await supabase.from("savings_goals").update({ archived_at: new Date().toISOString() }).eq("id", id.data);
  userDataChanged();
}
