import type { Pose, Track, TrackSample, Vec3 } from "../types";
import { ribbon } from "./ribbon";

/** Hauteur de pose du centre de la caisse au-dessus de l'axe : la voiture retombe doucement sur ses suspensions. */
const POSE_LIFT = 1;

const poseOn = (point: Vec3, tangent: Vec3): Pose => {
  // Rotation autour de Y qui amène l'avant local (-Z) sur la tangente. À plat : un tonneau repart toujours sur ses roues.
  const yaw = Math.atan2(-tangent.x, -tangent.z);
  return {
    position: { x: point.x, y: point.y + POSE_LIFT, z: point.z },
    rotation: { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) },
  };
};

export const createTrack = (
  points: Vec3[],
  width: number,
  closed: boolean,
): Track => {
  if (points.length < 2) throw new Error("Un tracé demande au moins 2 points");

  const n = points.length;
  const segments = closed ? n : n - 1;
  const tangents: Vec3[] = [];
  const starts: number[] = [];
  let length = 0;
  for (let i = 0; i < segments; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dy, dz) || 1;
    tangents.push({ x: dx / len, y: dy / len, z: dz / len });
    starts.push(length);
    length += len;
  }

  // ponytail: parcours linéaire des segments, environ 1000 par tracé et 4 roues par pas ; grille spatiale si un profil le réclame.
  const nearest = (x: number, z: number): TrackSample => {
    let bestD2 = Infinity;
    let bestI = 0;
    let bestT = 0;
    for (let i = 0; i < segments; i++) {
      const a = points[i];
      const b = points[(i + 1) % n];
      const abx = b.x - a.x;
      const abz = b.z - a.z;
      const len2 = abx * abx + abz * abz;
      const t =
        len2 > 0
          ? Math.max(0, Math.min(1, ((x - a.x) * abx + (z - a.z) * abz) / len2))
          : 0;
      const dx = a.x + abx * t - x;
      const dz = a.z + abz * t - z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD2) {
        bestD2 = d2;
        bestI = i;
        bestT = t;
      }
    }
    const a = points[bestI];
    const b = points[(bestI + 1) % n];
    const nextStart = bestI + 1 < segments ? starts[bestI + 1] : length;
    return {
      s: starts[bestI] + (nextStart - starts[bestI]) * bestT,
      point: {
        x: a.x + (b.x - a.x) * bestT,
        y: a.y + (b.y - a.y) * bestT,
        z: a.z + (b.z - a.z) * bestT,
      },
      tangent: tangents[bestI],
      distance: Math.sqrt(bestD2),
    };
  };

  return {
    points,
    closed,
    width,
    length,
    ribbon: ribbon(points, width, closed),
    nearest,
    surfaceAt: (x, z) =>
      nearest(x, z).distance <= width / 2 ? "asphalt" : "grass",
    startPose: poseOn(points[0], tangents[0]),
    respawnPose: (x, z) => {
      const sample = nearest(x, z);
      return poseOn(sample.point, sample.tangent);
    },
  };
};
