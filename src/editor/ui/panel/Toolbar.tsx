"use client";

import { ArrowLeftRight, Redo2, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { canRedo, canUndo } from "../../history";
import { useEditor } from "../../store";

/** Annuler, rétablir, inverser, vider : ce qui agit sur tout le tracé. */
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
      className="ml-2 flex gap-1"
    >
      <Button
        variant="secondary"
        size="icon-lg"
        aria-label="Annuler (Ctrl+Z)"
        title="Annuler (Ctrl+Z)"
        disabled={!canUndo(history)}
        onClick={undo}
      >
        <Undo2 aria-hidden="true" />
      </Button>
      <Button
        variant="secondary"
        size="icon-lg"
        aria-label="Rétablir (Ctrl+Y)"
        title="Rétablir (Ctrl+Y)"
        disabled={!canRedo(history)}
        onClick={redo}
      >
        <Redo2 aria-hidden="true" />
      </Button>
      <Button
        variant="secondary"
        size="icon-lg"
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
        size="icon-lg"
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
