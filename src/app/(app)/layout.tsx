import { Suspense } from "react";
import { Rail, RailView, TabBar, TabBarView } from "@/components/nav";
import { RefreshOnReturn } from "@/components/refresh-on-return";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="app">
      <div className="shell shell-2col">
        <Suspense fallback={<RailView pathname="" />}>
          <Rail />
        </Suspense>
        <main className="main">{children}</main>
      </div>
      <RefreshOnReturn />
      <Suspense fallback={<TabBarView pathname="" />}>
        <TabBar />
      </Suspense>
    </div>
  );
}
