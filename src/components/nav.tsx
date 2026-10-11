"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Inbox, Menu, Plus, Settings, Wallet, type LucideIcon } from "lucide-react";

type Item = { href: string; label: string; icon: LucideIcon };

const TABS: Item[] = [
  { href: "/", label: "Home", icon: House },
  { href: "/review", label: "Review", icon: Inbox },
  { href: "/accounts", label: "Accounts", icon: Wallet },
  { href: "/more", label: "More", icon: Menu },
];

const RAIL: Item[] = [
  { href: "/", label: "Home", icon: House },
  { href: "/review", label: "Review", icon: Inbox },
  { href: "/accounts", label: "Accounts", icon: Wallet },
];

function isCurrent(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Highlights the current page. Reads the URL, so layouts wrap it in <Suspense> with the plain view as fallback. */
export function TabBar() {
  return <TabBarView pathname={usePathname()} />;
}

export function TabBarView({ pathname }: { pathname: string }) {
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map(({ href, label, icon: Icon }, index) => [
        index === 2 && (
          <Link key="add" href="/add" className="tab add" aria-label="Add transaction" aria-current={pathname === "/add" ? "page" : undefined}>
            <span className="plus"><Plus aria-hidden /></span>
          </Link>
        ),
        <Link
          key={href}
          href={href}
          className="tab"
          aria-current={isCurrent(pathname, href) || (href === "/more" && pathname.startsWith("/settings")) ? "page" : undefined}
        >
          <Icon aria-hidden />
          {label}
        </Link>,
      ])}
    </nav>
  );
}

export function Rail() {
  return <RailView pathname={usePathname()} />;
}

export function RailView({ pathname }: { pathname: string }) {
  return (
    <nav className="rail" aria-label="Main">
      <p className="brand">Budget</p>
      <Link href="/add" className="btn primary rail-add">
        <Plus aria-hidden />
        Add transaction
      </Link>
      {RAIL.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} className="nav-item" aria-current={isCurrent(pathname, href) ? "page" : undefined}>
          <Icon aria-hidden />
          {label}
        </Link>
      ))}
      <div className="rail-foot">
        <Link href="/settings" className="nav-item" aria-current={isCurrent(pathname, "/settings") ? "page" : undefined}>
          <Settings aria-hidden />
          Settings
        </Link>
      </div>
    </nav>
  );
}
