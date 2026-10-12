"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { parsePesoInput } from "@/lib/money-input";
import { userDataChanged } from "@/lib/user-data";

export type PlanState = { status: "idle" | "saved" } | { status: "error"; message: string };

/** An empty field clears that value; anything else must be a valid amount. */
function optionalPeso(raw: FormDataEntryValue | null): number | null | undefined {
  const text = String(raw ?? "").trim();
  if (text === "") return null;
  return parsePesoInput(text) ?? undefined;
}

const day = z.coerce.number().int().min(1).max(31);
const paydaySchema = z.discriminatedUnion("payMode", [
  z.object({ payMode: z.literal("once"), payday1: day }),
  z.object({ payMode: z.literal("twice"), payday1: day, payday2: day }),
]);

export async function saveSpendingPlan(_prev: PlanState, formData: FormData): Promise<PlanState> {
  const income = optionalPeso(formData.get("income"));
  const limit = optionalPeso(formData.get("limit"));
  if (income === undefined) return { status: "error", message: "Enter your income as an amount, like 30,000." };
  if (limit === undefined) return { status: "error", message: "Enter the limit as an amount, like 15,000." };
  const pay = paydaySchema.safeParse(Object.fromEntries(formData));
  if (!pay.success) return { status: "error", message: "Pick your payday." };
  const paydays = pay.data.payMode === "once" ? [pay.data.payday1] : [...new Set([pay.data.payday1, pay.data.payday2])].sort((a, b) => a - b);

  const { supabase, userId } = await requireUser();
  const { error } = await supabase
    .from("profiles")
    .update({ monthly_income_centavos: income, spending_limit_centavos: limit, paydays })
    .eq("user_id", userId);
  if (error) return { status: "error", message: "Couldn't save your plan. Try again." };
  userDataChanged();
  return { status: "saved" };
}

export type CategoryResult = { ok: true } | { ok: false; message: string };

/** Saves one category's fixed flag and monthly limit (empty limit = none). Rows with neither are removed. */
export async function saveCategorySetting(input: { categoryId: string; fixed: boolean; limit: string }): Promise<CategoryResult> {
  const parsed = z.object({ categoryId: z.uuid(), fixed: z.boolean(), limit: z.string().trim().max(20) }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Something went wrong. Reload and try again." };
  const limit = optionalPeso(parsed.data.limit);
  if (limit === undefined) return { ok: false, message: "Enter the limit as an amount, like 5,000." };

  const { supabase, userId } = await requireUser();
  const { error } =
    parsed.data.fixed || limit !== null
      ? await supabase.from("category_settings").upsert({
          user_id: userId,
          category_id: parsed.data.categoryId,
          fixed: parsed.data.fixed,
          monthly_limit_centavos: limit,
        })
      : await supabase.from("category_settings").delete().eq("category_id", parsed.data.categoryId);
  if (error) return { ok: false, message: "Couldn't save. Try again." };
  userDataChanged();
  return { ok: true };
}
