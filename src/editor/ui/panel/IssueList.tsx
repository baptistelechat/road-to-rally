"use client";

import { editorStore, useEditor } from "../../store";

/** Le texte de chaque problème, la couleur de la carte ne suffisant pas. Un clic montre l'endroit. */
export const IssueList = () => {
  const issues = useEditor((state) => state.issues);
  const analysisError = useEditor((state) => state.analysisError);
  return (
    <section aria-label="Problèmes du tracé" aria-live="polite">
      {analysisError && (
        <p role="alert" className="text-xs text-destructive">
          {analysisError}
        </p>
      )}
      {issues.length > 0 && (
        <ul className="max-h-48 space-y-1 overflow-y-auto text-xs">
          {issues.map((issue, i) => {
            const { position } = issue;
            const label = issue.blocking ? "Bloquant" : "À savoir";
            const tone = issue.blocking ? "text-destructive" : "text-amber-400";
            const text = (
              <>
                <strong className="font-semibold">{label} : </strong>
                {issue.message}
              </>
            );
            return (
              <li key={`${issue.code}-${i}`}>
                {position ? (
                  <button
                    type="button"
                    title="Voir sur la carte"
                    className={`rounded text-left hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${tone}`}
                    onClick={() =>
                      editorStore.setState({ focus: { position } })
                    }
                  >
                    {text}
                  </button>
                ) : (
                  <p className={tone}>{text}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
