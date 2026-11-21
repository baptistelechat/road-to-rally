import type { Track } from "../types";

/**
 * Courbure signée en chaque point sur une fenêtre de 10 pas : positive quand la route tourne à droite.
 * Par défaut sur tout le tracé, retour d'un aller-retour compris, car le copilote l'annonce aussi.
 * À part de `scenery.ts` : le décor lit les notes du copilote (`brakeBoards.ts`), qui lisent cette courbure.
 */
export const signedCurvature = (
  track: Track,
  points: Track["points"] = track.points,
): number[] => {
  const { closed } = track;
  const n = points.length;
  const span = 5;
  return points.map((p, i) => {
    if (!closed && (i < span || i >= n - span)) return 0;
    const a = points[(i - span + n) % n];
    const b = points[(i + span) % n];
    const ux = p.x - a.x;
    const uz = p.z - a.z;
    const vx = b.x - p.x;
    const vz = b.z - p.z;
    const angle = Math.atan2(ux * vz - uz * vx, ux * vx + uz * vz);
    return (2 * angle) / (Math.hypot(ux, uz) + Math.hypot(vx, vz));
  });
};
