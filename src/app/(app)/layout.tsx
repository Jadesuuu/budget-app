import { Suspense } from "react";
import { Rail, RailView, TabBar, TabBarView } from "@/components/nav";
import { DemoBar } from "@/components/demo-bar";
import { RefreshOnReturn } from "@/components/refresh-on-return";
import { DEMO } from "@/lib/demo/mode";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="app">
      {DEMO ? <DemoBar /> : null}
      <div className="shell shell-2col">
        <Suspense fallback={<RailView pathname="" />}>
          <Rail />
        </Suspense>
        <main className="main">{children}</main>
      </div>
      {/* Nothing arrives in the background in the demo, and each poll there is a PGlite query on Vercel CPU. */}
      {DEMO ? null : <RefreshOnReturn />}
      <Suspense fallback={<TabBarView pathname="" />}>
        <TabBar />
      </Suspense>
    </div>
  );
}
