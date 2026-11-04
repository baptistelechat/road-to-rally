"use client";

import { Play } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { customStageUrl } from "@/game/maps";
import { StageProgress } from "@/game/Hud/components/StageProgress";
import { deleteStoredStage, storeCustomStage } from "@/game/stageCache";
import {
  useStageImport,
  type ImportStatus,
  type LoadedStage,
} from "@/game/useStageImport";
import { toOsmWays } from "@/geo/osm";
import { fetchPlaceName } from "@/geo/placeName";
import { chicaneRequests } from "../../chicanes";
import { readDraftStage, writeDraftStage } from "../../draft";
import { editorStore, rollBlocker, stageGpx, useEditor } from "../../store";
import type { EditorTrace } from "../../types";
import { useChicanes } from "../useChicanes";
import { RemovedChicanes } from "./RemovedChicanes";

const FALLBACK_NAME = "Ma spéciale";
const IDLE_STATUS: ImportStatus = { kind: "idle" };

/** La fin d'une génération qui ne mène pas directement au jeu. */
interface Outcome {
  trace: EditorTrace;
  degraded?: LoadedStage;
  storageFailed?: boolean;
}

/** Le nom proposé tant que le joueur n'en donne pas : la commune du premier point. */
const usePlaceDefault = (): string => {
  const first = useEditor(
    (state) => state.history.present.anchors[0]?.position,
  );
  const [place, setPlace] = useState<string | null>(null);
  useEffect(() => {
    if (!first) return;
    const controller = new AbortController();
    fetchPlaceName(first, { signal: controller.signal })
      .then((name) => {
        if (!controller.signal.aborted) setPlace(name);
      })
      // Un confort seulement : sans réponse, le nom générique suffit.
      .catch(() => {});
    return () => controller.abort();
  }, [first]);
  return first && place ? `Spéciale de ${place}` : FALLBACK_NAME;
};

/** Écrire d'abord, naviguer ensuite : une vraie navigation perd tout ce qui n'est pas sur le disque. */
const openStage = async (loaded: LoadedStage): Promise<boolean> => {
  const { history, name } = editorStore.getState();
  const key = await storeCustomStage(loaded.gpx, loaded, {
    ...history.present,
    name,
  });
  if (!key) return false;
  // Tracer, tester, corriger : la version testée remplace la précédente, la liste ne se remplit pas d'essais.
  const previous = readDraftStage();
  if (previous && previous !== key) await deleteStoredStage(previous);
  writeDraftStage(key);
  window.location.assign(customStageUrl(key));
  return true;
};

const STORAGE_ERROR =
  "La spéciale n'a pas pu être enregistrée dans ce navigateur (navigation privée ou stockage plein) : impossible de passer au jeu.";

export const RollPanel = () => {
  const id = useId();
  const trace = useEditor((state) => state.history.present);
  const name = useEditor((state) => state.name);
  const setName = useEditor((state) => state.setName);
  const blocker = useEditor(rollBlocker);
  const chicanes = useChicanes();
  const placeDefault = usePlaceDefault();
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const open = useCallback((loaded: LoadedStage): void => {
    void openStage(loaded).then((opened) => {
      if (!opened)
        setOutcome({
          trace: editorStore.getState().history.present,
          storageFailed: true,
        });
    });
  }, []);
  // Stable : un nouveau callback relancerait la génération en cours.
  const handleReady = useCallback(
    (loaded: LoadedStage) => {
      if (loaded.warnings.length > 0)
        setOutcome({
          trace: editorStore.getState().history.present,
          degraded: loaded,
        });
      else open(loaded);
    },
    [open],
  );
  const { status, chooseText, retry, cancel } = useStageImport(handleReady);

  // Le tracé a changé pendant la génération : la spéciale attendue n'est plus celle qu'on prépare.
  useEffect(() => cancel(), [trace, cancel]);

  // Ce résultat ne vaut que pour le tracé qui l'a produit.
  const current = outcome?.trace === trace ? outcome : null;
  const degraded = current?.degraded;
  const settled = degraded || current?.storageFailed;
  const running = status.kind === "running" && !settled;
  // Après une modification, seules disparaissent les chicanes déplacées ou supprimées : les autres restent à traiter sans régénérer.
  const removals = outcome?.degraded?.removals ?? [];
  const remaining = removals.filter(({ position }) =>
    chicanes.some(
      (chicane) =>
        chicane.position.lat === position.lat &&
        chicane.position.lon === position.lon,
    ),
  );

  const roll = (): void => {
    setOutcome(null);
    chooseText(
      stageGpx(trace),
      name.trim() || placeDefault,
      chicaneRequests(chicanes),
      toOsmWays(trace.segments),
    );
  };

  // Ce qui suit un clic sur « Rouler » s'affiche sous la barre : la génération, un avertissement, un refus d'enregistrer.
  const shownStatus = settled ? IDLE_STATUS : status;
  const hasDetails =
    shownStatus.kind !== "idle" ||
    degraded !== undefined ||
    remaining.length > 0 ||
    current?.storageFailed === true;

  return (
    <div className="relative flex min-w-0 items-center gap-2">
      <label htmlFor={`${id}-name`} className="sr-only">
        Nom de la spéciale
      </label>
      <input
        id={`${id}-name`}
        type="text"
        value={name}
        placeholder={placeDefault}
        maxLength={80}
        className="w-56 min-w-0 rounded-md border border-input bg-transparent px-2 py-1 text-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        onChange={(event) => setName(event.currentTarget.value)}
      />

      {!running && !degraded && blocker && (
        <p
          id={`${id}-reason`}
          title={blocker}
          className="max-w-72 truncate text-xs text-muted-foreground"
        >
          {blocker}
        </p>
      )}

      {running ? (
        <Button variant="outline" size="sm" onClick={cancel}>
          Annuler
        </Button>
      ) : (
        !degraded && (
          <Button
            size="sm"
            disabled={blocker !== null}
            aria-describedby={blocker ? `${id}-reason` : undefined}
            onClick={roll}
          >
            <Play aria-hidden="true" />
            Rouler
          </Button>
        )
      )}

      {hasDetails && (
        <div className="absolute top-full right-0 z-20 mt-2 w-80 space-y-2 rounded-lg border bg-background p-3 shadow-md">
          <StageProgress status={shownStatus} />
          {degraded && (
            <div role="alert" className="space-y-2 text-xs">
              {degraded.warnings
                .filter(
                  (warning) =>
                    !removals.some(({ message }) => message === warning),
                )
                .map((warning) => (
                  <p key={warning} className="text-amber-400">
                    {warning}
                  </p>
                ))}
              <RemovedChicanes removals={removals} />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => open(degraded)}>
                  Rouler quand même
                </Button>
                <Button variant="outline" size="sm" onClick={roll}>
                  Réessayer
                </Button>
              </div>
            </div>
          )}
          {!degraded && !running && remaining.length > 0 && (
            <div className="space-y-2 text-xs">
              <p className="text-muted-foreground">
                À la dernière génération :
              </p>
              <RemovedChicanes removals={remaining} />
            </div>
          )}
          {status.kind === "failed" && !settled && (
            <Button variant="outline" size="sm" onClick={retry}>
              Réessayer
            </Button>
          )}
          {current?.storageFailed && (
            <p role="alert" className="text-xs text-destructive">
              {STORAGE_ERROR}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
