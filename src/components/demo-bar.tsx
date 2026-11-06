import { RotateCcw } from "lucide-react";
import { resetDemoAction } from "@/app/(app)/demo-actions";

/** Shown on every screen of the demo build, so nobody mistakes the sample money for real money. */
export function DemoBar() {
  return (
    <aside className="demo-bar" aria-label="Demo">
      <p>
        <strong>Demo.</strong> Sam and every peso here are made up. What you change stays in this browser.
      </p>
      <form action={resetDemoAction}>
        <button type="submit" className="demo-reset">
          <RotateCcw aria-hidden />
          Reset
        </button>
      </form>
    </aside>
  );
}
