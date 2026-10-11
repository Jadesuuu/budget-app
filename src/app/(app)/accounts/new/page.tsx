import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { getInstitutionOptions } from "@/lib/data/accounts";
import { todayInManila } from "@/lib/dates";
import { AccountForm } from "../account-form";

export const metadata: Metadata = { title: "Add account" };

export default function NewAccountPage() {
  return (
    <>
      <PageHeader title="Add account" />
      <Suspense fallback={<div className="skeleton" style={{ height: 360 }} aria-busy="true" />}>
        <Form />
      </Suspense>
    </>
  );
}

async function Form() {
  const institutions = await getInstitutionOptions();
  return <AccountForm institutions={institutions} today={todayInManila()} />;
}
