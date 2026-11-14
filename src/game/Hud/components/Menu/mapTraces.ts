"use client";

// Vignettes des cartes du menu : le vrai tracé de chaque carte, réduit à quelques centaines de points.
import { useEffect, useState } from "react";
import { CatmullRomCurve3, Vector3 } from "three";
import { readCachedStage } from "@/game/stageCache";
import { CUSTOM_MAP_ID, MAPS } from "@/game/maps";
import { SANDBOX_SECTIONS } from "@/sim/track/sandboxTrack";
import type { StageData } from "@/sim/types";

/** Cadre des vignettes, en unités SVG */
export const TRACE_WIDTH = 270;
export const TRACE_HEIGHT = 110;
const MARGIN = 12;
const MAX_POINTS = 200;

interface Point2 {
  x: number;
  z: number;
}

/** Tracé dans le cadre, proportions gardées et centré. Nord en haut : x vers l'est, z vers le sud se lisent tels quels. */
export const tracePath = (
  points: readonly Point2[],
  closed: boolean,
): string => {
  const stride = Math.max(1, Math.ceil(points.length / MAX_POINTS));
  const kept = points.filter(
    (_, i) => i % stride === 0 || i === points.length - 1,
  );
  if (kept.length < 2) return "";
  const xs = kept.map((p) => p.x);
  const zs = kept.map((p) => p.z);
  const minX = Math.min(...xs);
  const minZ = Math.min(...zs);
  const width = Math.max(Math.max(...xs) - minX, 1e-6);
  const height = Math.max(Math.max(...zs) - minZ, 1e-6);
  const scale = Math.min(
    (TRACE_WIDTH - 2 * MARGIN) / width,
    (TRACE_HEIGHT - 2 * MARGIN) / height,
  );
  const dx = (TRACE_WIDTH - width * scale) / 2;
  const dz = (TRACE_HEIGHT - height * scale) / 2;
  const d = kept
    .map(
      (p, i) =>
        `${i ? "L" : "M"}${(dx + (p.x - minX) * scale).toFixed(1)} ${(dz + (p.z - minZ) * scale).toFixed(1)}`,
    )
    .join("");
  return closed ? `${d}Z` : d;
};

/** Du départ à l'arrivée, sans les prolongements de la spéciale : `startS` et `finishS` se comptent le long de `points`. */
const stageCourse = ({ points, startS, finishS }: StageData): Point2[] => {
  const course: Point2[] = [];
  let s = 0;
  points.forEach((point, i) => {
    const previous = points[i - 1];
    if (previous)
      s += Math.hypot(
        point.x - previous.x,
        point.y - previous.y,
        point.z - previous.z,
      );
    if (s >= startS && s <= finishS) course.push(point);
  });
  return course;
};

const isStage = (value: unknown): value is StageData =>
  typeof value === "object" &&
  value !== null &&
  "points" in value &&
  Array.isArray(value.points) &&
  "startS" in value &&
  typeof value.startS === "number" &&
  "finishS" in value &&
  typeof value.finishS === "number";

/** Le circuit : la même courbe que `createSandboxTrack`, sans construire la piste. */
const circuitPath = (): string =>
  tracePath(
    new CatmullRomCurve3(
      SANDBOX_SECTIONS.flatMap(({ points }) =>
        points.map(([x, z]) => new Vector3(x, 0, z)),
      ),
      true,
      "centripetal",
    ).getSpacedPoints(MAX_POINTS),
    true,
  );

const loadStage = async (id: string): Promise<StageData | null> => {
  if (id === CUSTOM_MAP_ID) {
    const key = new URLSearchParams(window.location.search).get("stage");
    return key ? readCachedStage(key) : null;
  }
  const map = MAPS.find((entry) => entry.id === id);
  if (map?.createStage) return map.createStage();
  if (!map?.stageUrl) return null;
  // Déjà dans le cache HTTP pour la carte en cours ; les autres pèsent quelques Mo, chargés une seule fois.
  const response = await fetch(map.stageUrl, { cache: "force-cache" });
  if (!response.ok) return null;
  const data: unknown = await response.json();
  return isStage(data) ? data : null;
};

const traces = new Map<string, Promise<string | null>>();

/** Une spéciale importée n'a pas de source à relire : pas de vignette. */
const loadTrace = (id: string): Promise<string | null> => {
  let trace = traces.get(id);
  if (!trace) {
    trace =
      id === "track"
        ? Promise.resolve(circuitPath())
        : loadStage(id)
            .then((stage) =>
              stage ? tracePath(stageCourse(stage), false) : null,
            )
            .catch((error: unknown) => {
              console.warn(
                `Vignette de la carte « ${id} » indisponible`,
                error,
              );
              return null;
            });
    traces.set(id, trace);
  }
  return trace;
};

/** Tracé SVG de la carte dans un cadre de 270 × 110, `null` tant qu'il se calcule ou s'il n'existe pas. */
export const useMapTrace = (id: string): string | null => {
  const [trace, setTrace] = useState<{ id: string; path: string | null }>({
    id,
    path: null,
  });
  useEffect(() => {
    let live = true;
    void loadTrace(id).then((path) => {
      if (live) setTrace({ id, path });
    });
    return () => {
      live = false;
    };
  }, [id]);
  return trace.id === id ? trace.path : null;
};
