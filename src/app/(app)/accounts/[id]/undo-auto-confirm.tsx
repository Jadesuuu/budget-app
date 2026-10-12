"use client";

import { useState, useTransition } from "react";
import { reopenTransaction } from "../../review/actions";

/** Sends an auto-confirmed transaction (both legs, for a transfer) back to the review inbox. */
export function UndoAutoConfirm({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  return (
    <button
      type="button"
      className="text-btn"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await reopenTransaction({ id });
          setFailed(!result.ok);
        })
      }
    >
      {failed ? "Couldn't undo" : pending ? "Sending to review…" : "Review it instead"}
    </button>
  );
}
