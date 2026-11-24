import { STEP } from "@/geo/config";
import type { Track, Vec3 } from "@/sim/types";

/**
 * Dans un tunnel, le point d'axe le plus proche, la distance à l'axe et le bord du bas-côté, là où passe la paroi.
 * `null` hors tunnel. Le retour d'un aller-retour recopie l'aller : les tunnels n'existent que sur l'axe unique.
 */
export const tunnelAt = (
  track: Track,
  x: number,
  z: number,
): {
  point: Vec3;
  /** Sens de la route en ce point */
  tangent: Vec3;
  distance: number;
  edge: number;
  /** Distance au portail devant, dans le sens de la route, puis à celui de derrière, le long de l'axe, en mètres */
  ahead: number;
  behind: number;
} | null => {
  const { tunnels, shared } = track;
  if (!tunnels || tunnels.length === 0) return null;
  const sample = track.nearest(x, z);
  let i = track.indexAt(sample.s);
  // Sur le retour, la route parcourt l'axe unique à l'envers.
  const reversed = shared != null && i > shared.returnStart;
  if (shared && reversed) i = shared.armEnd - (i - shared.returnStart);
  const tunnel = tunnels.find((t) => i >= t.from && i <= t.to);
  if (!tunnel) return null;
  const toEnd = (tunnel.to - i) * STEP;
  const toStart = (i - tunnel.from) * STEP;
  return {
    point: sample.point,
    tangent: sample.tangent,
    distance: sample.distance,
    edge: track.unique.widths[i] / 2 + track.unique.shoulders[i],
    ahead: reversed ? toStart : toEnd,
    behind: reversed ? toEnd : toStart,
  };
};
