"use client";

import { useState } from "react";
import { hudButton } from "../hudStyles";

/** Avertissements de la spéciale en cours, sur une plaque facettée. La zone reste montée pour que l'annonce soit lue ; vide, elle ne prend aucune place. */
export const StageNotices = ({ notices }: { notices: readonly string[] }) => {
  const [dismissed, setDismissed] = useState(false);
  return (
    <div aria-live="polite" className="max-w-xs">
      {!dismissed && notices.length > 0 && (
        <div className="pointer-events-auto mb-2 space-y-2 border-l-4 border-chart-3 bg-background/90 py-2 pr-6 pl-3 text-xs [clip-path:polygon(0_0,100%_0,calc(100%_-_14px)_100%,0_100%)]">
          {notices.map((notice) => (
            <p key={notice}>{notice}</p>
          ))}
          <button
            type="button"
            className={hudButton}
            onClick={() => setDismissed(true)}
          >
            Compris
          </button>
        </div>
      )}
    </div>
  );
};
