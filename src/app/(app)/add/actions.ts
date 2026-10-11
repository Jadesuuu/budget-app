"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { parsePesoInput } from "@/lib/money-input";

export type AddState = { status: "idle" } | { status: "error"; message: string };

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date.");
const time = z.string().regex(/^(\d{2}:\d{2})?$/, "Pick a time.");

/** A calendar date + optional time entered in the Philippines, as an instant. */
function manilaInstant(day: string, at: string): string {
  return `${day}T${at || "12:00"}:00+08:00`;
}

const entrySchema = z.object({
  mode: z.enum(["out", "in", "transfer"]),
  amount: z.string(),
  date,
  time,
  note: z.string().trim().max(1000).optional(),
});

export async function addEntry(_prev: AddState, formData: FormData): Promise<AddState> {
  const parsed = entrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0].message };
  const amount = parsePesoInput(parsed.data.amount);
  if (amount === null) return { status: "error", message: "Enter an amount, like 289 or 1,500.50." };
  const occurredAt = manilaInstant(parsed.data.date, parsed.data.time);
  const { supabase } = await requireUser();

  if (parsed.data.mode === "transfer") {
    const ids = z.object({ from: z.uuid(), to: z.uuid() }).safeParse(Object.fromEntries(formData));
    if (!ids.success) return { status: "error", message: "Choose both accounts for the transfer." };
    if (ids.data.from === ids.data.to) return { status: "error", message: "Choose two different accounts." };
    const rawFee = String(formData.get("fee") ?? "").trim();
    const fee = rawFee === "" || rawFee === "0" ? 0 : parsePesoInput(rawFee);
    if (fee === null) return { status: "error", message: "Enter the fee as an amount, or leave it empty." };

    const { error } = await supabase.rpc("create_transfer", {
      p_from_account: ids.data.from,
      p_to_account: ids.data.to,
      p_amount_centavos: amount,
      p_occurred_at: occurredAt,
      p_fee_centavos: fee,
      p_note: parsed.data.note || undefined,
    });
    if (error) return { status: "error", message: "Couldn't record the transfer. Try again." };
  } else {
    const fields = z
      .object({
        account: z.uuid("Choose an account."),
        merchant: z.string().trim().min(1, "Say what it was for.").max(200),
        category: z.union([z.uuid(), z.literal("")]),
      })
      .safeParse(Object.fromEntries(formData));
    if (!fields.success) return { status: "error", message: fields.error.issues[0].message };

    const { error } = await supabase.from("transactions").insert({
      account_id: fields.data.account,
      amount_centavos: parsed.data.mode === "out" ? -amount : amount,
      occurred_at: occurredAt,
      merchant: fields.data.merchant,
      category_id: fields.data.category || null,
      note: parsed.data.note || null,
      status: "confirmed",
      source: "manual",
      confirmed_at: new Date().toISOString(),
    });
    if (error) return { status: "error", message: "Couldn't save it. Try again." };
  }

  redirect(formData.get("again") ? "/add?saved=1" : "/");
}
