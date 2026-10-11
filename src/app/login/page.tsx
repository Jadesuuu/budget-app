import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

const MAILBOX_URL = process.env.NODE_ENV === "development" ? "http://127.0.0.1:54324" : null;

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="login">
      <div className="login-card">
        <p className="brand">Budget</p>
        <h1>Sign in</h1>
        <p className="login-lede">We&apos;ll email you a link. No password to remember.</p>
        <Suspense fallback={null}>
          <LinkError searchParams={searchParams} />
        </Suspense>
        <LoginForm mailboxUrl={MAILBOX_URL} />
      </div>
    </main>
  );
}

async function LinkError({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { error } = await searchParams;
  if (error !== "link") return null;
  return (
    <p className="form-error" role="alert">
      That sign-in link has expired or was already used. Request a new one below.
    </p>
  );
}
