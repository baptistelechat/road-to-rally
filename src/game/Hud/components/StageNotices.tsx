"use client";

import { useState } from "react";
import { panel } from "../hudStyles";

/** Avertissements de la spéciale en cours. La zone reste montée pour que l'annonce soit lue. */
export const StageNotices = ({ notices }: { notices: readonly string[] }) => {
  const [dismissed, setDismissed] = useState(false);
  return (
    <div aria-live="polite" className="max-w-xs">
      {!dismissed && notices.length > 0 && (
        <div
          className={`${panel} pointer-events-auto space-y-2 px-3 py-2 text-xs`}
        >
          {notices.map((notice) => (
            <p key={notice}>{notice}</p>
          ))}
          <button
            type="button"
            className="rounded border border-foreground/25 px-2 py-0.5 font-semibold transition-colors hover:bg-foreground/15 focus-visible:outline-2 focus-visible:outline-brand"
            onClick={() => setDismissed(true)}
          >
            Compris
          </button>
        </div>
      )}
    </div>
  );
};
