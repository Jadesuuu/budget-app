import Link from "next/link";
import { cachedUserData } from "@/lib/user-data";
import { Suspense, type ReactNode } from "react";
import { getProfile, initialsOf } from "@/lib/auth";
import { HideBalancesToggle } from "./hide-balances-toggle";

export function PageHeader({ title, balances = false }: { title: ReactNode; balances?: boolean }) {
  return (
    <header className="topbar">
      <h1 className="page-title">{title}</h1>
      <div className="topbar-end">
        {balances && <HideBalancesToggle />}
        <Suspense fallback={<span className="avatar" aria-hidden />}>
          <Avatar />
        </Suspense>
      </div>
    </header>
  );
}

async function Avatar() {
  "use cache: private";
  cachedUserData();
  const profile = await getProfile();
  return (
    <Link href="/settings" className="avatar" aria-label="Settings">
      {initialsOf(profile.display_name, profile.email)}
    </Link>
  );
}
