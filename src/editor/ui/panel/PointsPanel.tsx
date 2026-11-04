"use client";

import {
  ArrowLeftRight,
  Loader2,
  Redo2,
  RotateCw,
  Route,
  Trash2,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatKm } from "@/geo/errors";
import { canRedo, canUndo } from "../../history";
import { editorStore, useEditor } from "../../store";
import { anchorDistances, stageLength } from "../../trace";
import { ReturnAction } from "./ReturnAction";

export const Toolbar = () => {
  const history = useEditor((state) => state.history);
  const pending = useEditor((state) => state.status.pending);
  const undo = useEditor((state) => state.undo);
  const redo = useEditor((state) => state.redo);
  const reverse = useEditor((state) => state.reverse);
  const clear = useEditor((state) => state.clear);
  const empty = history.present.anchors.length === 0;
  return (
    <div
      role="toolbar"
      aria-label="Actions sur le tracé"
      className="flex gap-1"
    >
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Annuler (Ctrl+Z)"
        title="Annuler (Ctrl+Z)"
        disabled={!canUndo(history)}
        onClick={undo}
      >
        <Undo2 aria-hidden="true" />
      </Button>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Rétablir (Ctrl+Y)"
        title="Rétablir (Ctrl+Y)"
        disabled={!canRedo(history)}
        onClick={redo}
      >
        <Redo2 aria-hidden="true" />
      </Button>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Inverser le sens du tracé"
        title={
          history.present.returnRoute
            ? "Un aller-retour repart du même endroit : rien à inverser"
            : "Inverser le sens du tracé"
        }
        disabled={empty || pending || history.present.returnRoute !== null}
        onClick={() => void reverse()}
      >
        <ArrowLeftRight aria-hidden="true" />
      </Button>
      <Button
        variant="destructive"
        size="icon-sm"
        aria-label="Tout vider"
        title="Tout vider"
        disabled={empty}
        onClick={() => {
          // ponytail: boîte native, accessible et sans dépendance ; un `Dialog` shadcn si elle détonne.
          if (window.confirm("Vider tout le tracé ? Ctrl+Z le rétablit."))
            clear();
        }}
      >
        <Trash2 aria-hidden="true" />
      </Button>
    </div>
  );
};

export const RouteMessages = () => {
  const status = useEditor((state) => state.status);
  const notice = useEditor((state) => state.notice);
  const draftSaved = useEditor((state) => state.draftSaved);
  const retry = useEditor((state) => state.retry);
  return (
    <div
      aria-live="polite"
      className="space-y-1 rounded-lg border bg-background px-3 py-2 text-xs shadow-md empty:hidden"
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

  return (
    <div className="space-y-2 text-sm">
      <p>
        Spéciale :{" "}
        <strong className="font-semibold tabular-nums">
          {(length / 1000).toFixed(2).replace(".", ",")} km
        </strong>
      </p>
      {trace.anchors.length === 0 ? (
        <p className="text-muted-foreground">
          Clique sur une route de la carte pour poser le premier point.
        </p>
      ) : (
        <ol className="max-h-48 space-y-1 overflow-y-auto">
          {trace.anchors.map((anchor, i) => (
            <li key={anchor.id} className="flex items-center gap-2">
              <button
                type="button"
                title="Voir sur la carte"
                className="flex-1 rounded text-left tabular-nums hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                onClick={() =>
                  editorStore.setState({ focus: { position: anchor.position } })
                }
              >
                Point {i + 1}, {formatKm(distances[i])}
              </button>
              {((i === 0 && runoffs?.before) ||
                (i === trace.anchors.length - 1 && runoffs?.after)) && (
                <Loader2
                  aria-hidden="true"
                  className="size-3 animate-spin text-muted-foreground"
                />
              )}
              {i > 0 && (
                <Button
                  variant="ghost"
                  size="icon-xs"
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
                size="icon-xs"
                aria-label={`Supprimer le point ${i + 1}`}
                disabled={pending}
                onClick={() => void removePoint(anchor.id)}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ol>
      )}
      <ReturnAction />
    </div>
  );
};
