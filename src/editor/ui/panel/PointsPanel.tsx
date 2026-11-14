"use client";

import { Loader2, RotateCw, Route, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatKm } from "@/geo/errors";
import { editorStore, useEditor } from "../../store";
import { anchorDistances, stageLength } from "../../trace";
import { mapSurface } from "../styles";
import { ReturnAction } from "./ReturnAction";

export const RouteMessages = () => {
  const status = useEditor((state) => state.status);
  const notice = useEditor((state) => state.notice);
  const draftSaved = useEditor((state) => state.draftSaved);
  const retry = useEditor((state) => state.retry);
  return (
    <div
      aria-live="polite"
      className={`space-y-1 rounded-lg border px-3 py-2 text-xs shadow-md empty:hidden ${mapSurface}`}
    >
      {status.pending && (
        <p className="flex items-center gap-1 text-muted-foreground">
          <Loader2 aria-hidden="true" className="size-3 animate-spin" />
          {status.runoffs
            ? `Recherche de la route ${
                status.runoffs.before && status.runoffs.after
                  ? "avant le départ et après l'arrivée"
                  : status.runoffs.before
                    ? "avant le départ"
                    : "après l'arrivée"
              }…`
            : "Calcul de la route…"}
        </p>
      )}
      {notice && <p className="text-muted-foreground">{notice}</p>}
      {status.error && (
        <div role="alert" className="space-y-1 text-destructive">
          <p>{status.error}</p>
          {status.canRetry && (
            <Button variant="outline" size="sm" onClick={() => void retry()}>
              <RotateCw aria-hidden="true" />
              Réessayer
            </Button>
          )}
        </div>
      )}
      {!draftSaved && (
        <p role="alert" className="text-destructive">
          Le brouillon n&apos;a pas pu être enregistré : il sera perdu en
          quittant la page.
        </p>
      )}
    </div>
  );
};

/** Tout ce qu'un marqueur permet au pointeur, ici au clavier : un marqueur de carte ne suffit pas. */
export const PointsPanel = () => {
  const trace = useEditor((state) => state.history.present);
  const pending = useEditor((state) => state.status.pending);
  const runoffs = useEditor((state) => state.status.runoffs);
  const removePoint = useEditor((state) => state.removePoint);
  const searchVariants = useEditor((state) => state.searchVariants);
  const searching = useEditor((state) => state.variants?.kind === "searching");
  const distances = anchorDistances(trace);
  const length = stageLength(trace);

  const last = trace.anchors.length - 1;

  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="text-xs text-muted-foreground">
        Spéciale :{" "}
        <strong className="font-mono text-foreground">
          {(length / 1000).toFixed(2).replace(".", ",")} km
        </strong>
      </p>
      {trace.anchors.length === 0 ? (
        <p className="text-muted-foreground">
          Clique sur une route de la carte pour poser le premier point.
        </p>
      ) : (
        <ol className="flex flex-col gap-1.5">
          {trace.anchors.map((anchor, i) => {
            const end = i === 0 || i === last;
            return (
              <li
                key={anchor.id}
                className="flex min-h-11 items-center gap-1 rounded-lg border bg-card pr-1 font-bold"
              >
                <button
                  type="button"
                  title="Voir sur la carte"
                  aria-label={`Point ${i + 1}, ${formatKm(distances[i])}, voir sur la carte`}
                  className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2.5 text-left text-[0.8125rem] hover:bg-accent/60 focus-line-visible"
                  onClick={() =>
                    editorStore.setState({
                      focus: { position: anchor.position },
                    })
                  }
                >
                  <span
                    aria-hidden="true"
                    className={`grid size-7 shrink-0 place-items-center rounded-md font-mono ${
                      end ? "bg-foreground text-background" : "border border-input"
                    }`}
                  >
                    {i === 0
                      ? "D"
                      : i === last
                        ? "A"
                        : String(i + 1).padStart(2, "0")}
                  </span>
                  <span aria-hidden="true">
                    {i === 0 ? "Départ" : i === last ? "Arrivée" : "Passage"}
                  </span>
                  <span
                    aria-hidden="true"
                    className="ml-auto font-mono text-xs font-normal text-muted-foreground"
                  >
                    {formatKm(distances[i])}
                  </span>
                </button>
                {((i === 0 && runoffs?.before) ||
                  (i === last && runoffs?.after)) && (
                  <Loader2
                    aria-hidden="true"
                    className="size-3 animate-spin text-muted-foreground"
                  />
                )}
                {i > 0 && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Chercher une autre route jusqu'au point ${i + 1}`}
                    title={`Chercher une autre route jusqu'au point ${i + 1}`}
                    disabled={
                      pending ||
                      searching ||
                      trace.returnRoute !== null ||
                      !trace.segments[i - 1]
                    }
                    onClick={() => void searchVariants(i - 1)}
                  >
                    <Route aria-hidden="true" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Supprimer le point ${i + 1}`}
                  disabled={pending}
                  onClick={() => void removePoint(anchor.id)}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </li>
            );
          })}
        </ol>
      )}
      <ReturnAction className="w-full" />
    </div>
  );
};
