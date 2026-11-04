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
import { GhostCar } from "@/render/car/GhostCar";
import { loadLivery } from "@/render/car/livery";
import { DustParticles } from "@/render/fx/DustParticles";
import { createDustPool } from "@/render/fx/dustPool";
import { ExhaustFlame } from "@/render/fx/ExhaustFlame";
import { ImpactSparks } from "@/render/fx/ImpactSparks";
import { SkidMarks } from "@/render/fx/SkidMarks";
import { LightPropsView } from "@/render/scenery/LightPropsView";
import { SceneryView } from "@/render/scenery/SceneryView";
import { StartLights } from "@/render/track/StartLights";
import { TrackView } from "@/render/track/TrackView";
import {
  createGhostPlayer,
  createLinearGhost,
  parseGhost,
} from "@/sim/ghostTrack";
import { isLightProp } from "@/sim/lightProps";
import type { Simulation } from "@/sim/simulation";
import type { Copilot } from "./copilot";
import { Diagnostics } from "./diag/Diagnostics";
import { Hud } from "./Hud";
import { setHudMuted, useHudStore } from "./hudStore";
import { createGhostOutlet, type GhostOutlet } from "./ghostOutlet";
import { customMap, importedMap, mapFromParam, mapSearch } from "./maps";
import { type RecordIdentity, readStageRecord } from "./stageRecords";
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
  /** Une scène par spéciale : en changer remonte la scène et relit le record */
  identity: RecordIdentity;
  /** La boucle y écrit la pose du fantôme, que la mini-carte relit hors du canvas */
  ghostOutlet: GhostOutlet;
}

const Scene = ({
  sim,
  audio,
  copilot,
  useBot,
  identity,
  ghostOutlet,
}: SceneProps) => {
  const [cameraMode, setCameraMode] = useState<"chase" | "hood">("chase");
  const [livery] = useState(loadLivery);
  const [dust] = useState(createDustPool);
  const staticScenery = useMemo(
    () => sim.scenery.filter((item) => !isLightProp(item.kind)),
    [sim],
  );
  const capture = useRef<(() => void) | null>(null);
  const [record, setRecord] = useState(() => readStageRecord(identity));
  const showGhost = useHudStore((s) => s.copilotOptions.ghostEnabled);
  // Relu seulement après un nouveau record : le fantôme ne change pas en pleine course.
  // Record sans poses (repris de l'ancienne clé) : un fantôme à allure constante qui passe la ligne au temps du record.
  const ghost = useMemo(() => {
    if (!showGhost || !record) return null;
    const data = parseGhost(record.ghost);
    return data
      ? createGhostPlayer(data)
      : createLinearGhost(sim.track, record.totalMs);
  }, [record, showGhost, sim]);
  const { source, ghostSource, info, cameraOrbit } = useGameLoop({
    sim,
    audio,
    copilot,
    useBot,
    identity,
    record,
    ghost,
    onRecord: setRecord,
    ghostOutlet,
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
      <StartLights track={sim.track} getCountdown={sim.countdown} />
      <SceneryView items={staticScenery} />
      <LightPropsView props={sim.props} />
      {/* Les trois panneaux à la fois : FPS, ms et mémoire. */}
      <Stats className="!top-auto !bottom-4 !left-1/2 !flex -translate-x-1/2 gap-px [&>canvas]:!block" />
      <CarModel source={source} livery={livery} />
      <GhostCar source={ghostSource} />
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
  const [ghostOutlet] = useState(createGhostOutlet);

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
          key={map.recordId}
          sim={game.sim}
          audio={game.audio}
          copilot={game.copilot}
          useBot={params.has("bot")}
          identity={map}
          ghostOutlet={ghostOutlet}
        />
      </Canvas>
      <Hud
        sim={game.sim}
        ghost={ghostOutlet}
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
