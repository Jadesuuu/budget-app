import type { Metadata, Viewport } from "next";
import { fontVariables } from "@/lib/fonts";
import { themeBootScript } from "@/lib/themes";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Budget", template: "%s · Budget" },
  description: "Review the transactions your bank emails already told you about.",
  appleWebApp: { capable: true, title: "Budget", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The boot script sets data-theme / data-mode before paint, so React must not fight it.
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
