import type { StageData, Track } from "../types";
import { createTrack } from "./createTrack";
import { createMeshHeight } from "./meshHeight";
import { GROUND_Y, shoulderStrips, SHOULDER_WIDTH } from "./ribbon";

export const createStageTrack = (stage: StageData): Track => {
  const track = createTrack(stage.points, stage.widths, false, {
    startS: stage.startS,
    finishS: stage.finishS,
    terrain: stage.terrain,
    shared: stage.shared,
    obstacles: stage.obstacles,
    islands: stage.islands,
  });
  if (stage.lanes)
    track.laneCounts = stage.lanes.slice(0, track.unique.points.length);
  if (!stage.terrain) return track;
  const height = createMeshHeight([
    stage.terrain,
    track.ribbon,
    ...shoulderStrips(
      track.unique.points,
      track.unique.widths,
      track.unique.shoulders,
      false,
    ),
  ]);
  return {
    ...track,
    groundAt: (x, z) => {
      const y = height(x, z);
      if (y !== null) return y;
      // Le ruban et le bas-côté n'ont pas tout à fait le même bord dans une épingle : pas de trou sur la route.
      const sample = track.nearest(x, z);
      return sample.distance <= sample.width / 2 + SHOULDER_WIDTH
        ? sample.point.y + GROUND_Y
        : null;
    },
  };
};
