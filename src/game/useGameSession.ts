"use client";

import type { RootState } from "@react-three/fiber";
import { type RefObject, useEffect, useRef, useState } from "react";
import { createCarAudio, type CarAudio } from "@/audio/engineAudio";
import { loadLivery } from "@/render/car/livery";
import { initRapier } from "@/sim/rapier";
import {
  createSimulation,
  prepareScenery,
  type Simulation,
} from "@/sim/simulation";
import { createStageTrack } from "@/sim/track/stage";
import { parseStage } from "@/sim/track/stageCodec";
import type { StageData } from "@/sim/types";
import { createCopilot, type Copilot } from "./copilot";
import { applyAudioOptions } from "./copilotOptions";
import { setHudMuted, setHudScreen, useHudStore } from "./hudStore";
import type { GameMap } from "./maps";

/** Au-delà, le joueur a vu l'écran se figer (l'étape la plus longue du chargement) : on lui dit pourquoi. */
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
  copilot: Copilot;
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
): GameSessionResult => {
  const [game, setGame] = useState<GameSession | null>(null);
  const [failed, setFailed] = useState(false);
  const canvasRootRef = useRef<RootState | null>(null);

  // Strict Mode lance cet effet deux fois en développement : on libère toujours le monde créé.
  useEffect(() => {
    // Créée dans l'éditeur ou importée depuis « Mes spéciales » : le même trajet.
    const given = map.custom ?? null;
    let cancelled = false;
    let created: Simulation | null = null;
    let copilot: Copilot | null = null;
    const download = new AbortController();
    // Créé ici et non en `useMemo` : un ancien moteur continuerait de jouer après chaque mise à jour à chaud.
    const audio = createCarAudio(undefined, loadLivery().engine);
    const unlock = (): void => audio.unlock();
    // Tenté tout de suite : passe si le joueur a déjà agi sur le site (changement de carte, retour du garage).
    // Sinon le navigateur l'exige d'un geste, et une manette n'en est pas un : l'écran de départ le demande.
    audio.start();
    window.addEventListener("keydown", unlock);
    window.addEventListener("pointerup", unlock);
    setHudMuted(false);
    // Chaque carte repasse par l'écran de départ, sauf le pilote automatique.
    setHudScreen(params.has("bot") ? "race" : "start");
    void Promise.all([
      initRapier(),
      given?.stage ??
        map.createStage?.() ??
        (map.stageUrl ? loadStage(map.stageUrl, download.signal) : undefined),
    ])
      .then(async ([, stage]) => {
        if (given) await nextPaint();
        if (cancelled) return;
        // Piste, décor puis colliders, avec un rendu entre chaque : l'écran ne reste jamais figé pendant tout le chargement.
        const phases: number[] = [];
        const timed = <T>(run: () => T): T => {
          const startedAt = performance.now();
          const result = run();
          phases.push(performance.now() - startedAt);
          return result;
        };
        const track = stage ? timed(() => createStageTrack(stage)) : undefined;
        if (track) await nextPaint();
        if (cancelled) return;
        const scenery = track ? timed(() => prepareScenery(track)) : undefined;
        if (track) await nextPaint();
        if (cancelled) return;
        created = timed(() =>
          createSimulation(undefined, stage, { track, scenery }),
        );
        const creationMs = Math.max(...phases);
        if (stage)
          console.info(
            `Simulation créée en ${phases.map(Math.round).join(" + ")} ms (piste, décor, colliders)`,
          );
        copilot = createCopilot(created, audio);
        applyAudioOptions(copilot, useHudStore.getState().copilotOptions);
        // Sans bloquer le jeu : un mot manquant s'affiche dans la console et les icônes continuent.
        void copilot.voice.load();
        setGame({
          sim: created,
          audio,
          copilot,
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
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("pointerup", unlock);
      copilot?.reset();
      audio.dispose();
      // Le canvas se démonte après ce nettoyage : une image de plus lirait un monde déjà libéré.
      // `get()` : R3F remplace `internal` juste après `onCreated`, l'objet reçu alors est déjà périmé.
      if (canvasRootRef.current)
        canvasRootRef.current.get().internal.active = false;
      canvasRootRef.current = null;
      created?.free();
    };
  }, [params, map]);

  return { game, failed, canvasRootRef };
};
