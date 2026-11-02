"use client";

import {
  ArrowLeftRight,
  ChevronDown,
  ChevronUp,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { STEP } from "@/geo/config";
import { formatKm } from "@/geo/errors";
import type { ListedChicane } from "../../chicanes";
import { useEditor } from "../../store";
import { useChicanes } from "../useChicanes";

const SIDE_LABEL = { left: "gauche", right: "droite" } as const;

const countLabel = (count: number): string =>
  count === 0
    ? "Aucune chicane"
    : count === 1
      ? "1 chicane"
      : `${count} chicanes`;

const ChicaneRow = ({ chicane }: { chicane: ListedChicane }) => {
  const runoffPoints = useEditor(
    (state) => state.analysis?.axis?.runoffPoints ?? 0,
  );
  const pending = useEditor((state) => state.status.pending);
  const nudge = useEditor((state) => state.nudgeChicaneBy);
  const flip = useEditor((state) => state.flipChicaneSide);
  const remove = useEditor((state) => state.removeChicaneById);
  const km = formatKm((chicane.index - runoffPoints) * STEP);
  const actions = [
    {
      label: `Reculer la chicane du ${km}`,
      Icon: ChevronDown,
      run: () => nudge(chicane.id, -1),
    },
    {
      label: `Avancer la chicane du ${km}`,
      Icon: ChevronUp,
      run: () => nudge(chicane.id, 1),
    },
    {
      label: `Changer le côté de la chicane du ${km}`,
      Icon: ArrowLeftRight,
      run: () => flip(chicane.id),
    },
    {
      label: `Supprimer la chicane du ${km}`,
      Icon: Trash2,
      run: () => remove(chicane.id),
    },
  ];
  return (
    <li className="flex items-center gap-1">
      <span className="flex-1 text-xs tabular-nums">
        {km}, {SIDE_LABEL[chicane.side]}
        {chicane.origin === "player" ? ", à toi" : ""}
      </span>
      {actions.map(({ label, Icon, run }) => (
        <Button
          key={label}
          variant="ghost"
          size="icon-xs"
          aria-label={label}
          title={label}
          disabled={pending}
          onClick={run}
        >
          <Icon aria-hidden="true" />
        </Button>
      ))}
    </li>
  );
};

/** Tout ce que la carte permet, ici au clavier : compteur, interrupteur, liste, ajout et remise à zéro. */
export const ChicanePanel = () => {
  const id = useId();
  const chicanes = useChicanes();
  const trace = useEditor((state) => state.history.present);
  const axisReady = useEditor((state) => state.analysis?.axis != null);
  const tooNarrow = useEditor((state) => state.autoChicanes?.tooNarrow ?? 0);
  const pending = useEditor((state) => state.status.pending);
  const add = useEditor((state) => state.addChicaneAt);
  const setEnabled = useEditor((state) => state.setChicanesEnabled);
  const reset = useEditor((state) => state.resetAutoChicanes);
  const touched = trace.chicanes.length > 0 || trace.removedChicanes.length > 0;

  if (trace.segments.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        Les chicanes se placent une fois le tracé posé.
      </p>
    );

  return (
    <div className="space-y-2 text-sm">
      <label
        htmlFor={`${id}-enabled`}
        className="flex items-center gap-2 font-medium"
      >
        <input
          id={`${id}-enabled`}
          type="checkbox"
          role="switch"
          className="size-4 accent-orange-500"
          checked={trace.chicanesEnabled}
          disabled={pending}
          onChange={(event) => setEnabled(event.currentTarget.checked)}
        />
        <span aria-live="polite">
          {trace.chicanesEnabled
            ? countLabel(chicanes.length)
            : "Chicanes retirées"}
        </span>
      </label>

      {trace.chicanesEnabled && (
        <>
          {chicanes.length > 0 && (
            <ul className="max-h-40 space-y-1 overflow-y-auto">
              {/* Par rang, pas par identifiant : déplacer une automatique la fait changer d'identifiant, et le clavier perdrait son bouton. */}
              {chicanes.map((chicane, i) => (
                <ChicaneRow key={i} chicane={chicane} />
              ))}
            </ul>
          )}
          {tooNarrow > 0 && (
            <p className="text-xs text-muted-foreground">
              {tooNarrow === 1
                ? "Une ligne droite reste sans chicane : la route y semble trop étroite."
                : `${tooNarrow} lignes droites restent sans chicane : la route y semble trop étroite.`}
            </p>
          )}
          <div className="flex flex-wrap gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={pending || !axisReady}
              onClick={() => add()}
            >
              <Plus aria-hidden="true" />
              Ajouter
            </Button>
            {touched && (
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => {
                  // ponytail: boîte native, comme « Tout vider ».
                  if (
                    window.confirm(
                      "Rétablir les chicanes automatiques ? Tes choix seront oubliés. Ctrl+Z les rétablit.",
                    )
                  )
                    reset();
                }}
              >
                <RotateCcw aria-hidden="true" />
                Rétablir les chicanes automatiques
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Glisse une chicane le long du tracé, ou fais un clic droit sur le
            tracé pour en ajouter une.
          </p>
        </>
      )}
    </div>
  );
};
