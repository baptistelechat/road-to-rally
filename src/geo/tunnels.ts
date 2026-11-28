// Tunnels de la spéciale (PR-21) : découpe le long de l'axe, comme les ponts.
import type { MeshData, StageTunnel } from "../sim/types";
import { tunnelPortal } from "../sim/track/tunnelShape";
import { STEP } from "./config";

/** Plus court, ce n'est pas un tunnel mais un point apparié par erreur sous un pont ou un passage, en mètres */
const TUNNEL_MIN_LENGTH = 15;

/** Retire les suites de points de tunnel trop courtes pour en être un (6 m dans les gorges de la Bourne). */
export const dropShortTunnels = (inTunnel: readonly boolean[]): boolean[] => {
  const kept = [...inTunnel];
  let i = 0;
  while (i < kept.length) {
    if (!kept[i]) {
      i++;
      continue;
    }
    let end = i;
    while (end + 1 < kept.length && kept[end + 1]) end++;
    if ((end - i) * STEP < TUNNEL_MIN_LENGTH)
      for (let k = i; k <= end; k++) kept[k] = false;
    i = end + 1;
  }
  return kept;
};

/**
 * Une entrée par suite de points dans un tunnel. `edge` : demi-largeur de la route, bas-côtés compris, en chaque point.
 * `roofFor` : la montagne au-dessus du tube entre deux points, `null` si la roche ne le recouvre nulle part.
 */
export const findStageTunnels = (
  inTunnel: readonly boolean[],
  edge: number[],
  roofFor: ((from: number, to: number) => MeshData | null) | null,
  /** Classe OSM de la route en un point du tunnel, `null` si inconnue : choisit le portail */
  highwayAt: (i: number) => string | null,
): StageTunnel[] => {
  const tunnels: StageTunnel[] = [];
  let i = 0;
  while (i < inTunnel.length) {
    if (!inTunnel[i]) {
      i++;
      continue;
    }
    let end = i;
    while (end + 1 < inTunnel.length && inTunnel[end + 1]) end++;
    if (end > i) {
      const halfWidth = Math.max(...edge.slice(i, end + 1));
      const roof = roofFor?.(i, end) ?? null;
      tunnels.push({
        from: i,
        to: end,
        halfWidth: Math.round(halfWidth * 1000) / 1000,
        portal: tunnelPortal(
          (end - i) * STEP,
          highwayAt(Math.round((i + end) / 2)),
        ),
        ...(roof && { roof }),
      });
    }
    i = end + 1;
  }
  return tunnels;
};
