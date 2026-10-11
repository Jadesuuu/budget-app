import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth";
import { todayInManila } from "@/lib/dates";
import type { CategoryOption } from "@/lib/data/inbox";
import { AddForm } from "./add-form";

export const metadata: Metadata = { title: "Add" };

export default function AddPage({ searchParams }: PageProps<"/add">) {
  return (
    <>
      <PageHeader title="Add" />
      <Suspense fallback={<div className="skeleton" style={{ height: 420 }} aria-busy="true" />}>
        <Form searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Form({ searchParams }: { searchParams: PageProps<"/add">["searchParams"] }) {
  const { saved } = await searchParams;
  const { supabase } = await requireUser();
  const [accounts, categories] = await Promise.all([
    supabase.from("accounts").select("id, name, last4").is("archived_at", null).order("name"),
    supabase.from("categories").select("id, name, kind").order("name"),
  ]);
  if (accounts.error) throw accounts.error;
  if (categories.error) throw categories.error;

  if (accounts.data.length === 0) {
    return (
      <div className="empty">
        <h2>Add an account first</h2>
        <p>Every transaction belongs to an account, like your BPI savings or GCash.</p>
        <Link href="/accounts/new" className="btn primary">Add an account</Link>
      </div>
    );
  }

  return (
    <>
      {saved && <p className="form-success" role="status">Saved. Add the next one.</p>}
      <AddForm accounts={accounts.data} categories={categories.data as CategoryOption[]} today={todayInManila()} />
    </>
  );
}
