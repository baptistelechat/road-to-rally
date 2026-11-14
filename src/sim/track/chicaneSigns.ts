import { SHOULDER_WIDTH } from "./ribbon";
import type {
  ChicaneBlock,
  ChicaneSide,
  SceneryItem,
  SceneryKind,
  Track,
  Vec3,
} from "../types";

/** Distance entre le panneau d'annonce et le premier bloc, en mètres */
const SIGN_AHEAD = 70;
/** Comme les panneaux jaunes : le collider du mât suffit, la voiture passe sous le panneau. */
const SIGN_COLLIDER_RADIUS = 0.1;

/** Côté à prendre pour passer ce bloc : celui où la route reste libre. */
export const passageSide = ({
  side,
}: Pick<ChicaneBlock, "side">): ChicaneSide =>
  side === "left" ? "right" : "left";

export interface ApproachSign {
  position: Vec3;
  yaw: number;
  direction: ChicaneSide;
}

/**
 * Un panneau avant chaque chicane, du côté où il faudra passer.
 * Les blocs vont par paires dans l'ordre des abscisses (`stageCodec` le valide) : un sur deux ouvre une chicane.
 * `bothWays` : aller-retour, la chicane se passe aussi en sens inverse, deuxième bloc d'abord.
 */
export const approachSigns = (
  blocks: ChicaneBlock[],
  {
    points,
    widths,
    indexAt,
    groundAt,
  }: Pick<Track, "points" | "widths" | "indexAt" | "groundAt">,
  bothWays: boolean,
): ApproachSign[] => {
  /** `heading` : 1 dans le sens de l'axe, -1 à contresens. */
  const sign = (
    s: number,
    heading: number,
    direction: ChicaneSide,
  ): ApproachSign => {
    const i = indexAt(s);
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(points.length - 1, i + 1)];
    const dx = (b.x - a.x) * heading;
    const dz = (b.z - a.z) * heading;
    const length = Math.sqrt(dx * dx + dz * dz) || 1;
    const lateral =
      (direction === "left" ? -1 : 1) * (widths[i] / 2 + SHOULDER_WIDTH + 0.5);
    const x = points[i].x + (-dz / length) * lateral;
    const z = points[i].z + (dx / length) * lateral;
    return {
      position: { x, y: groundAt(x, z) ?? points[i].y, z },
      yaw: Math.atan2(-dx, -dz),
      direction,
    };
  };
  return blocks.flatMap((block, i, all) =>
    i % 2 !== 0
      ? []
      : [
          sign(block.s - SIGN_AHEAD, 1, passageSide(block)),
          // À contresens, le côté libre change de nom : il reste du côté où le bloc n'est pas.
          ...(bothWays
            ? [sign(all[i + 1].s + SIGN_AHEAD, -1, all[i + 1].side)]
            : []),
        ],
  );
};

/**
 * Le dessin suit l'écart du pilote, venu de sa voie de droite : il se déporte d'abord à l'opposé du côté libre.
 * Passer à droite se dessine donc avec un premier virage à gauche.
 */
export const chicaneSignKind = (direction: ChicaneSide): SceneryKind =>
  direction === "right" ? "chicaneSignLeft" : "chicaneSignRight";

/** Panneaux d'annonce en objets légers : la voiture les renverse comme les panneaux jaunes et les plots. */
export const chicaneSignItems = (track: Track): SceneryItem[] =>
  approachSigns(track.obstacles, track, track.shared !== null).map(
    ({ position, yaw, direction }) => ({
      kind: chicaneSignKind(direction),
      position,
      yaw,
      scale: 1,
      colliderRadius: SIGN_COLLIDER_RADIUS,
    }),
  );
