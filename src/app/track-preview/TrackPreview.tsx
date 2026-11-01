"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import { MAPS, mapFromParam, mapSearch } from "@/game/maps";
import { Atmosphere } from "@/render/Atmosphere";
import { SceneryView } from "@/render/scenery/SceneryView";
import { TrackView } from "@/render/track/TrackView";
import {
  createSandboxTrack,
  SANDBOX_SECTIONS,
  sandboxSectionStarts,
} from "@/sim/track/sandboxTrack";
import { generateScenery } from "@/sim/track/scenery";
import { createStageTrack } from "@/sim/track/stage";
import { parseStage } from "@/sim/track/stageCodec";
import type { StageData, Track } from "@/sim/types";

const SEED = 1;

const Preview = ({ track }: { track: Track }) => {
  const { scenery, center, height } = useMemo(() => {
    const xs = track.points.map((p) => p.x);
    const ys = track.points.map((p) => p.y);
    const zs = track.points.map((p) => p.z);
    const spanX = Math.max(...xs) - Math.min(...xs);
    const spanZ = Math.max(...zs) - Math.min(...zs);
    return {
      scenery: generateScenery(track, SEED),
      center: [
        (Math.min(...xs) + Math.max(...xs)) / 2,
        Math.min(...ys),
        (Math.min(...zs) + Math.max(...zs)) / 2,
      ] as [number, number, number],
      height: Math.max(650, Math.max(spanX, spanZ) * 1.15),
    };
  }, [track]);

  return (
    <>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{
          position: [center[0], center[1] + height, center[2] + 1],
          fov: 50,
          near: 1,
          far: 12000,
        }}
      >
        <Atmosphere fog={false} />
        <TrackView track={track} />
        <SceneryView items={scenery} />
        <OrbitControls target={center} maxPolarAngle={Math.PI / 2.05} />
      </Canvas>
      <ol className="pointer-events-none fixed top-4 left-4 rounded bg-black/60 p-3 text-xs text-neutral-100">
        <li className="mb-1 font-semibold">
          {Math.round(
            track.closed ? track.length : track.finishS - track.startS,
          )}{" "}
          m, {scenery.length} éléments
        </li>
        {track.closed
          ? SANDBOX_SECTIONS.map((section, i) => (
              <li key={section.name}>
                {Math.round(sandboxSectionStarts(track)[i])} m : {section.name}
              </li>
            ))
          : null}
      </ol>
    </>
  );
};

/** Page de jugement du tracé et du décor : vue de dessus, orbite à la souris, sans voiture. `?map=` choisit la piste. */
export const TrackPreview = () => {
  const map = useMemo(
    () =>
      mapFromParam(
        typeof window === "undefined"
          ? null
          : new URLSearchParams(window.location.search).get("map"),
      ),
    [],
  );
  const [stage, setStage] = useState<StageData | null>(null);
  const [failed, setFailed] = useState(false);
  const track = useMemo(
    () =>
      map.stageUrl ? stage && createStageTrack(stage) : createSandboxTrack(),
    [map, stage],
  );

  useEffect(() => {
    if (!map.stageUrl) return;
    const download = new AbortController();
    void fetch(map.stageUrl, { signal: download.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((json: unknown) => setStage(parseStage(json)))
      .catch(() => {
        if (!download.signal.aborted) setFailed(true);
      });
    return () => download.abort();
  }, [map]);

  return (
    <div className="fixed inset-0 bg-neutral-900">
      {track && <Preview track={track} />}
      {!track && (
        <p
          role={failed ? "alert" : "status"}
          className="fixed inset-0 grid place-items-center text-neutral-400"
        >
          {failed ? `Impossible de charger ${map.label}.` : "Chargement…"}
        </p>
      )}
      <nav
        aria-label="Pistes"
        className="fixed top-4 right-4 flex gap-3 rounded bg-black/60 p-3 text-xs text-neutral-100"
      >
        {MAPS.map(({ id, label }) => (
          <a
            key={id}
            href={mapSearch(id)}
            aria-current={id === map.id ? "page" : undefined}
            className="font-semibold underline-offset-2 hover:underline aria-[current=page]:text-amber-400"
          >
            {label}
          </a>
        ))}
      </nav>
    </div>
  );
};
