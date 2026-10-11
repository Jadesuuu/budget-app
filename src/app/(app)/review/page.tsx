import type { Metadata } from "next";
import { cachedUserData } from "@/lib/user-data";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { ReviewInbox } from "@/components/review-inbox";
import { getInbox } from "@/lib/data/inbox";

export const metadata: Metadata = { title: "Review" };

export default function ReviewPage() {
  return (
    <>
      <PageHeader title="Review" />
      <Suspense fallback={<div className="skeleton" style={{ height: 320 }} aria-busy="true" />}>
        <Inbox />
      </Suspense>
    </>
  );
}

async function Inbox() {
  "use cache: private";
  cachedUserData();
  const inbox = await getInbox();
  return (
    <section aria-label="Transactions to review">
      <p className="sec-sub review-lede">
        {inbox.items.length === 0
          ? "Nothing waiting."
          : `${inbox.items.length} waiting. Swipe right to confirm, left to ignore.`}
      </p>
      <ReviewInbox {...inbox} variant="page" />
    </section>
  );
}
