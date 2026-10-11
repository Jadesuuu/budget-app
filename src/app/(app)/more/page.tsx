import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, LogOut, Settings } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { signOut } from "../settings/actions";

export const metadata: Metadata = { title: "More" };

export default function MorePage() {
  return (
    <>
      <PageHeader title="More" />
      <ul className="link-list">
        <li>
          <Link href="/settings">
            <Settings aria-hidden />
            <span>Settings</span>
            <ChevronRight aria-hidden className="chev" />
          </Link>
        </li>
        <li>
          <form action={signOut}>
            <button type="submit">
              <LogOut aria-hidden />
              <span>Sign out</span>
            </button>
          </form>
        </li>
      </ul>
    </>
  );
}
