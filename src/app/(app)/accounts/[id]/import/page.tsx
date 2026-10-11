import type { Metadata } from "next";
import { cachedUserData } from "@/lib/user-data";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { getSession } from "@/lib/auth";
import { describeWhen } from "@/lib/inbox";
import { undoImport } from "./actions";
import { ImportForm } from "./import-form";

export const metadata: Metadata = { title: "Import history" };

// Where to get a complete history for each institution (verified steps only).
const HOW_TO: Record<string, string> = {
  gcash: "In GCash, open Transactions, tap Request transaction history, and pick the dates. GCash emails you a PDF.",
};

export default function ImportPage({ params }: PageProps<"/accounts/[id]/import">) {
  return (
    <>
      <PageHeader title="Import history" />
      <Suspense fallback={<div className="skeleton" style={{ height: 320 }} aria-busy="true" />}>
        <Content params={params} />
      </Suspense>
    </>
  );
}

async function Content({ params }: { params: PageProps<"/accounts/[id]/import">["params"] }) {
  const { id } = await params;
  return <ContentView id={id} />;
}

async function ContentView({ id }: { id: string }) {
  "use cache: private";
  cachedUserData();
  const { supabase } = await getSession();
  const [account, imports] = await Promise.all([
    supabase.from("accounts").select("id, name, institutions(slug, name)").eq("id", id).maybeSingle(),
    supabase.from("imports").select("id, file_name, created_at, rows_added, rows_matched").eq("account_id", id).order("created_at", { ascending: false }).limit(10),
  ]);
  if (account.error || imports.error) throw account.error ?? imports.error;
  if (!account.data) notFound();
  const howTo = HOW_TO[account.data.institutions?.slug ?? ""];

  return (
    <>
      <p className="settings-p">
        Upload a transaction history or statement for <b>{account.data.name}</b>. Budget matches it against what it
        already has and adds only what&apos;s missing, so nothing is counted twice.
      </p>
      {howTo && <p className="hint">{howTo}</p>}
      <ImportForm accountId={account.data.id} />

      {imports.data.length > 0 && (
        <section className="settings-sec" aria-labelledby="past-h">
          <h2 id="past-h" className="settings-h">Past imports</h2>
          <ul className="row-list">
            {imports.data.map((i) => (
              <li key={i.id} className="row">
                <div>
                  <p className="row-title">{i.file_name ?? "Import"}</p>
                  <p className="row-sub">{describeWhen(i.created_at)}: {i.rows_added} added, {i.rows_matched} already there</p>
                </div>
                <form action={undoImport}>
                  <input type="hidden" name="importId" value={i.id} />
                  <button className="mini-btn" type="submit">Undo</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Link href={`/accounts/${account.data.id}`} className="link-btn">Back to {account.data.name}</Link>
    </>
  );
}
