"use client";

import { Stats } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { createCarAudio, type CarAudio } from "@/audio/engineAudio";
import { Atmosphere } from "@/render/Atmosphere";
import { GameCamera } from "@/render/camera/GameCamera";
import { CarModel } from "@/render/car/CarModel";
import { loadLivery } from "@/render/car/livery";
import { DustParticles } from "@/render/fx/DustParticles";
import { SkidMarks } from "@/render/fx/SkidMarks";
import { LightPropsView } from "@/render/scenery/LightPropsView";
import { SceneryView } from "@/render/scenery/SceneryView";
import { TrackView } from "@/render/track/TrackView";
import { isLightProp } from "@/sim/lightProps";
import { initRapier } from "@/sim/rapier";
import { createSimulation, type Simulation } from "@/sim/simulation";
import { Diagnostics } from "./diag/Diagnostics";
import { setHudMuted } from "./hudStore";
import { Hud } from "./Hud";
import { useGameLoop } from "./useGameLoop";

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
  useBot: boolean;
}

const Scene = ({ sim, audio, useBot }: SceneProps) => {
  const [cameraMode, setCameraMode] = useState<"chase" | "hood">("chase");
  const [livery] = useState(loadLivery);
  const staticScenery = useMemo(
    () => sim.scenery.filter((item) => !isLightProp(item.kind)),
    [sim],
  );
  const capture = useRef<(() => void) | null>(null);
  const { source, info } = useGameLoop({
    sim,
    audio,
    useBot,
    onToggleCamera: () =>
      setCameraMode((mode) => (mode === "chase" ? "hood" : "chase")),
    onDiagRequest: () => capture.current?.(),
  });

  return (
    <>
      <GameCamera source={source} mode={cameraMode} />
      <Atmosphere follow={source} />
      <TrackView track={sim.track} />
      <SceneryView items={staticScenery} />
      <LightPropsView props={sim.props} />
      {/* Les trois panneaux à la fois : FPS, ms et mémoire. */}
      <Stats className="!top-auto !bottom-4 !left-1/2 !flex -translate-x-1/2 gap-px [&>canvas]:!block" />
      <CarModel source={source} livery={livery} />
      <DustParticles source={source} />
      <SkidMarks source={source} />
      <Diagnostics sim={sim} audio={audio} info={info} captureRef={capture} />
    </>
  );
};

export const Game = () => {
  const [game, setGame] = useState<{
    sim: Simulation;
    audio: CarAudio;
  } | null>(null);
  const params = useMemo(() => new URLSearchParams(window.location.search), []);

  // Strict Mode lance cet effet deux fois en développement : on libère toujours le monde créé.
  useEffect(() => {
    let cancelled = false;
    let created: Simulation | null = null;
    // Créé ici et non en `useMemo` : un ancien moteur continuerait de jouer après chaque mise à jour à chaud.
    const audio = createCarAudio();
    const start = (): void => audio.start();
    window.addEventListener("keydown", start);
    window.addEventListener("pointerup", start);
    setHudMuted(false);
    void initRapier().then(() => {
      if (cancelled) return;
      created = createSimulation();
      setGame({ sim: created, audio });
      if (params.has("debug"))
        (window as unknown as { __sim?: Simulation }).__sim = created;
    });
    return () => {
      cancelled = true;
      setGame(null);
      window.removeEventListener("keydown", start);
      window.removeEventListener("pointerup", start);
      audio.dispose();
      created?.free();
    };
  }, [params]);

  return (
    <div className="fixed inset-0 bg-neutral-900">
      {game && (
        <Canvas shadows dpr={[1, 1.75]} gl={{ antialias: true }}>
          <Scene sim={game.sim} audio={game.audio} useBot={params.has("bot")} />
        </Canvas>
      )}
      {game && <Hud />}
      {game && TuningPanel && <TuningPanel sim={game.sim} />}
    </div>
  );
};
