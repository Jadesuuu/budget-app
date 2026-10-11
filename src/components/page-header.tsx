import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { getProfile, initialsOf } from "@/lib/auth";

export function PageHeader({ title }: { title: ReactNode }) {
  return (
    <header className="topbar">
      <h1 className="page-title">{title}</h1>
      <Suspense fallback={<span className="avatar" aria-hidden />}>
        <Avatar />
      </Suspense>
    </header>
  );
}

async function Avatar() {
  const profile = await getProfile();
  return (
    <Link href="/settings" className="avatar" aria-label="Settings">
      {initialsOf(profile.display_name, profile.email)}
    </Link>
  );
}
