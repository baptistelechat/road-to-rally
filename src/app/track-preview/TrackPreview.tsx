"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useMemo } from "react";
import { Atmosphere } from "@/render/Atmosphere";
import { SceneryView } from "@/render/scenery/SceneryView";
import { TrackView } from "@/render/track/TrackView";
import {
  createSandboxTrack,
  SANDBOX_SECTIONS,
  sandboxSectionStarts,
} from "@/sim/track/sandboxTrack";
import { generateScenery } from "@/sim/track/scenery";

const SEED = 1;

/** Page de jugement du tracé et du décor : vue de dessus, orbite à la souris, sans voiture. */
export const TrackPreview = () => {
  const { track, scenery, starts, center } = useMemo(() => {
    const track = createSandboxTrack();
    const xs = track.points.map((p) => p.x);
    const zs = track.points.map((p) => p.z);
    return {
      track,
      scenery: generateScenery(track, SEED),
      starts: sandboxSectionStarts(track),
      center: [
        (Math.min(...xs) + Math.max(...xs)) / 2,
        0,
        (Math.min(...zs) + Math.max(...zs)) / 2,
      ] as [number, number, number],
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-neutral-900">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{
          position: [center[0], 650, center[2] + 1],
          fov: 50,
          near: 1,
          far: 4000,
        }}
      >
        <Atmosphere fog={false} />
        <TrackView track={track} />
        <SceneryView items={scenery} />
        <OrbitControls target={center} maxPolarAngle={Math.PI / 2.05} />
      </Canvas>
      <ol className="pointer-events-none fixed top-4 left-4 rounded bg-black/60 p-3 text-xs text-neutral-100">
        <li className="mb-1 font-semibold">
          {Math.round(track.length)} m, {scenery.length} éléments
        </li>
        {SANDBOX_SECTIONS.map((section, i) => (
          <li key={section.name}>
            {Math.round(starts[i])} m : {section.name}
          </li>
        ))}
      </ol>
    </div>
  );
};
