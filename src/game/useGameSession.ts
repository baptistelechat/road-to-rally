"use client";

import type { RootState } from "@react-three/fiber";
import { type RefObject, useEffect, useRef, useState } from "react";
import { createCarAudio, type CarAudio } from "@/audio/engineAudio";
import { initRapier } from "@/sim/rapier";
import { createSimulation, type Simulation } from "@/sim/simulation";
import { parseStage } from "@/sim/track/stageCodec";
import type { StageData } from "@/sim/types";
import { setHudMuted } from "./hudStore";
import type { GameMap } from "./maps";
import type { ImportedStage } from "./useStageImport";

/** Au-delà, le joueur a vu l'écran se figer : on lui dit pourquoi. */
const LONG_CREATION_MS = 500;

const loadStage = async (
  url: string,
  signal: AbortSignal,
): Promise<StageData> => {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`${url} : HTTP ${response.status}`);
  return parseStage(await response.json());
};

/** Une fois le rendu passé à l'écran : un calcul lancé juste après ne cache plus le message de chargement. */
const nextPaint = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => setTimeout(resolve));
    // `requestAnimationFrame` ne tourne pas dans un onglet caché.
    setTimeout(resolve, 100);
  });

export interface GameSession {
  sim: Simulation;
  audio: CarAudio;
  /** Avertissements à montrer au joueur */
  notices: readonly string[];
}

interface GameSessionResult {
  game: GameSession | null;
  failed: boolean;
  /** À remplir depuis `onCreated` du canvas : le nettoyage y arrête la boucle de rendu */
  canvasRootRef: RefObject<RootState | null>;
}

/** Une seule simulation à la fois : changer de carte libère l'ancienne avant de créer la nouvelle. */
export const useGameSession = (
  params: URLSearchParams,
  map: GameMap,
  imported: ImportedStage | null,
): GameSessionResult => {
  const [game, setGame] = useState<GameSession | null>(null);
  const [failed, setFailed] = useState(false);
  const canvasRootRef = useRef<RootState | null>(null);

  // Strict Mode lance cet effet deux fois en développement : on libère toujours le monde créé.
  useEffect(() => {
    // Importée sur place ou créée dans l'éditeur : le même trajet.
    const given = imported ?? map.custom ?? null;
    let cancelled = false;
    let created: Simulation | null = null;
    const download = new AbortController();
    // Créé ici et non en `useMemo` : un ancien moteur continuerait de jouer après chaque mise à jour à chaud.
    const audio = createCarAudio();
    const start = (): void => audio.start();
    window.addEventListener("keydown", start);
    window.addEventListener("pointerup", start);
    setHudMuted(false);
    void Promise.all([
      initRapier(),
      given?.stage ??
        (map.stageUrl ? loadStage(map.stageUrl, download.signal) : undefined),
    ])
      .then(async ([, stage]) => {
        if (given) await nextPaint();
        if (cancelled) return;
        const startedAt = performance.now();
        created = createSimulation(undefined, stage);
        const creationMs = performance.now() - startedAt;
        if (stage)
          console.info(
            `Colliders et simulation créés en ${Math.round(creationMs)} ms`,
          );
        setGame({
          sim: created,
          audio,
          notices: [
            ...(given?.warnings ?? []),
            ...(given && creationMs > LONG_CREATION_MS
              ? [
                  `La création des collisions a figé l'écran ${(creationMs / 1000).toFixed(1).replace(".", ",")} s.`,
                ]
              : []),
          ],
        });
        if (params.has("debug"))
          (window as unknown as { __sim?: Simulation }).__sim = created;
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error(error);
        setFailed(true);
      });
    return () => {
      cancelled = true;
      download.abort();
      setGame(null);
      window.removeEventListener("keydown", start);
      window.removeEventListener("pointerup", start);
      audio.dispose();
      // Le canvas se démonte après ce nettoyage : une image de plus lirait un monde déjà libéré.
      // `get()` : R3F remplace `internal` juste après `onCreated`, l'objet reçu alors est déjà périmé.
      if (canvasRootRef.current)
        canvasRootRef.current.get().internal.active = false;
      canvasRootRef.current = null;
      created?.free();
    };
  }, [params, map, imported]);

  return { game, failed, canvasRootRef };
};
