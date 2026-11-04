"use client";

import { Stats } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import dynamic from "next/dynamic";
import { useMemo, useRef, useState } from "react";
import type { CarAudio } from "@/audio/engineAudio";
import type { GeneratedStage } from "@/geo/stageWorkerClient";
import { Atmosphere } from "@/render/Atmosphere";
import { GameCamera } from "@/render/camera/GameCamera";
import { CarModel } from "@/render/car/CarModel";
import { loadLivery } from "@/render/car/livery";
import { DustParticles } from "@/render/fx/DustParticles";
import { createDustPool } from "@/render/fx/dustPool";
import { ExhaustFlame } from "@/render/fx/ExhaustFlame";
import { ImpactSparks } from "@/render/fx/ImpactSparks";
import { SkidMarks } from "@/render/fx/SkidMarks";
import { LightPropsView } from "@/render/scenery/LightPropsView";
import { SceneryView } from "@/render/scenery/SceneryView";
import { TrackView } from "@/render/track/TrackView";
import { isLightProp } from "@/sim/lightProps";
import type { Simulation } from "@/sim/simulation";
import type { Copilot } from "./copilot";
import { Diagnostics } from "./diag/Diagnostics";
import { Hud } from "./Hud";
import { setHudMuted } from "./hudStore";
import { customMap, importedMap, mapFromParam, mapSearch } from "./maps";
import { useGameLoop } from "./useGameLoop";
import { useGameSession } from "./useGameSession";
import type { ImportedStage } from "./useStageImport";

// Panneau de réglage : développement seulement, jamais dans le bundle de production.
const TuningPanel =
  process.env.NODE_ENV === "development"
    ? dynamic(() => import("./TuningPanel").then((mod) => mod.TuningPanel), {
        ssr: false,
      })
    : null;

interface SceneProps {
  sim: Simulation;
  audio: CarAudio;
  copilot: Copilot;
  useBot: boolean;
  bestLapKey: string;
}

const Scene = ({ sim, audio, copilot, useBot, bestLapKey }: SceneProps) => {
  const [cameraMode, setCameraMode] = useState<"chase" | "hood">("chase");
  const [livery] = useState(loadLivery);
  const [dust] = useState(createDustPool);
  const staticScenery = useMemo(
    () => sim.scenery.filter((item) => !isLightProp(item.kind)),
    [sim],
  );
  const capture = useRef<(() => void) | null>(null);
  const { source, info, cameraOrbit } = useGameLoop({
    sim,
    audio,
    copilot,
    useBot,
    bestLapKey,
    onToggleCamera: () =>
      setCameraMode((mode) => (mode === "chase" ? "hood" : "chase")),
    onDiagRequest: () => capture.current?.(),
  });

  return (
    <>
      <GameCamera
        source={source}
        track={sim.track}
        mode={cameraMode}
        orbit={cameraOrbit}
      />
      <Atmosphere follow={source} />
      <TrackView track={sim.track} />
      <SceneryView items={staticScenery} />
      <LightPropsView props={sim.props} />
      {/* Les trois panneaux à la fois : FPS, ms et mémoire. Sous la mini-carte (`top-16`, `size-40`), aligné sur son bord droit. */}
      <Stats className="!top-58 !right-4 !left-auto !flex flex-col gap-px [&>canvas]:!block" />
      <CarModel source={source} livery={livery} />
      <DustParticles source={source} pool={dust} />
      <ExhaustFlame source={source} audio={audio} dust={dust} />
      <ImpactSparks source={source} dust={dust} />
      <SkidMarks source={source} />
      <Diagnostics sim={sim} audio={audio} info={info} captureRef={capture} />
    </>
  );
};

const screen =
  "fixed inset-0 grid place-items-center bg-neutral-900 p-8 text-center text-neutral-400";

interface GameProps {
  /** Spéciale de l'éditeur, déjà relue depuis le cache par `GameEntry` */
  initialStage?: GeneratedStage;
}

export const Game = ({ initialStage }: GameProps) => {
  const [imported, setImported] = useState<ImportedStage | null>(null);
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const map = useMemo(
    () =>
      imported
        ? importedMap(imported.stage)
        : initialStage
          ? customMap(initialStage)
          : mapFromParam(params.get("map")),
    [params, imported, initialStage],
  );
  const { game, failed, canvasRootRef } = useGameSession(params, map, imported);

  if (failed)
    return (
      <div role="alert" className={screen}>
        <div className="space-y-3">
          <p>Impossible de charger la carte « {map.label} ».</p>
          <a
            href={mapSearch("track")}
            className="font-semibold text-amber-400 underline focus-visible:outline-2 focus-visible:outline-amber-400"
          >
            Revenir au circuit
          </a>
        </div>
      </div>
    );

  if (!game)
    return (
      <div role="status" className={screen}>
        {imported
          ? "Création de la route et de ses collisions… L'écran peut se figer quelques secondes."
          : "Chargement…"}
      </div>
    );

  return (
    <div className="fixed inset-0 bg-neutral-900">
      <Canvas
        shadows="percentage"
        dpr={[1, 1.75]}
        gl={{ antialias: true }}
        onCreated={(state) => {
          canvasRootRef.current = state;
        }}
      >
        <Scene
          sim={game.sim}
          audio={game.audio}
          copilot={game.copilot}
          useBot={params.has("bot")}
          bestLapKey={map.bestLapKey}
        />
      </Canvas>
      <Hud
        sim={game.sim}
        copilot={game.copilot}
        map={map.id}
        mapLabel={map.label}
        closed={game.sim.track.closed}
        notices={game.notices}
        onImported={setImported}
        onToggleMute={() => setHudMuted(game.audio.toggleMute())}
      />
      {TuningPanel && <TuningPanel sim={game.sim} />}
    </div>
  );
};
