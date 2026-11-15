import { createMeshHeight } from "../../sim/track/meshHeight";
import { createTrack } from "../../sim/track/createTrack";
import { ribbon } from "../../sim/track/ribbon";
import type { DecorWater, MeshData, StageDecor, Vec3 } from "../../sim/types";
import type { LatLon } from "../gpx";
import { buildBuildings } from "./buildings";
import type { DecorContext, DecorInputs } from "./types";
import { buildTrees } from "./vegetation";

export { fetchDecor } from "./fetchDecor";
export {
  createGroundTint,
  planWater,
  type GroundTint,
  type WaterPlan,
} from "./landcover";
export type { DecorInputs } from "./types";

/**
 * Décor réel de la spéciale, depuis les données brutes. Pure : mêmes entrées, même décor au bit près.
 * `undefined` sans données ou sans terrain : le décor procédural de la story 1.7 prend le relais.
 */
export const buildDecor = (
  decor: DecorInputs | null | undefined,
  axis: Vec3[],
  widths: number[],
  terrain: MeshData | null,
  origin: LatLon,
  baseAltitude: number,
  /** Nappes déjà posées par `planWater` avant le terrain, qui creuse leur lit (story 5.9) */
  water: DecorWater[],
): StageDecor | undefined => {
  if (!decor || !terrain) return undefined;
  const road = createTrack(axis, widths, false);
  const height = createMeshHeight([terrain, ribbon(axis, widths, false)]);
  const context: DecorContext = {
    origin,
    axis,
    widths,
    baseAltitude,
    roadClearance: (x, z) => {
      const sample = road.nearest(x, z);
      return sample.distance - sample.width / 2;
    },
    groundAt: height,
  };
  const buildings = buildBuildings(
    decor.buildings,
    context,
    decor.department ?? null,
  );
  const trees = buildTrees(
    decor.vegetation,
    decor.hedges,
    decor.fields,
    buildings,
    decor.water,
    context,
  );
  if (buildings.length + trees.length + water.length === 0) return undefined;
  return { buildings, trees, water };
};
