import { Rail, TabBar } from "@/components/nav";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="app">
      <div className="shell shell-2col">
        <Rail />
        <main className="main">{children}</main>
      </div>
      <TabBar />
    </div>
  );
}
