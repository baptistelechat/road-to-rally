// Maillages d'un tunnel (PR-21 à PR-23) : tube, portails et bandes de lampes, tous autour de l'axe unique.
import { BufferAttribute, BufferGeometry, Color } from "three";
import {
  TUNNEL_COVER,
  TUNNEL_VAULT_RISE,
  TUNNEL_VAULT_SEGMENTS,
  TUNNEL_WALL_HEIGHT,
  tunnelProfile,
} from "@/sim/track/tunnelShape";
import type { StageTunnel, TunnelPortal, Vec3 } from "@/sim/types";

/** Repère au point `i` : droite de la route (-dz, dx), comme les parois en collision, et sens de la route. */
const frameAt = (points: Vec3[], i: number) => {
  const prev = points[Math.max(0, i - 1)];
  const next = points[Math.min(points.length - 1, i + 1)];
  const len = Math.hypot(next.x - prev.x, next.z - prev.z) || 1;
  const tx = (next.x - prev.x) / len;
  const tz = (next.z - prev.z) / len;
  return { rx: -tz, rz: tx, tx, tz };
};

/**
 * Tube gris le long de l'axe (PR-21, paquet 1) : intrados, extrados à `TUNNEL_COVER` plus loin, et un anneau qui les
 * relie à chaque portail. Sans épaisseur, l'entrée se lisait comme une feuille de papier.
 */
export const tubeGeometry = (
  points: Vec3[],
  edge: (i: number) => number,
  tunnel: StageTunnel,
): BufferGeometry => {
  const count = tunnelProfile(1).length;
  const rings = tunnel.to - tunnel.from + 1;
  const positions: number[] = [];
  // Intrados puis extrados : `rings × count` sommets chacun.
  for (const grow of [0, TUNNEL_COVER])
    for (let i = tunnel.from; i <= tunnel.to; i++) {
      const { rx, rz } = frameAt(points, i);
      // Au bord réel du bas-côté : là où le terrain s'ouvre, sinon le relief entre dans le tube.
      for (const [lateral, height] of tunnelProfile(edge(i), grow))
        positions.push(
          points[i].x + rx * lateral,
          points[i].y + height,
          points[i].z + rz * lateral,
        );
    }
  const outer = rings * count;
  const indices: number[] = [];
  for (const base of [0, outer])
    for (let k = 0; k + 1 < rings; k++)
      for (let j = 0; j + 1 < count; j++) {
        const a = base + k * count + j;
        const b = a + 1;
        const c = a + count;
        const d = c + 1;
        indices.push(a, b, d, a, d, c);
      }
  // Anneaux des portails : chaque sommet de l'intrados relié au même sommet de l'extrados.
  for (const k of [0, rings - 1])
    for (let j = 0; j + 1 < count; j++) {
      const a = k * count + j;
      const b = a + 1;
      indices.push(a, b, b + outer, a, b + outer, a + outer);
    }
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(Float32Array.from(positions), 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
};

interface PortalSpec {
  /** Épaisseur du cadre autour de l'intrados, en mètres */
  frame: number;
  /** Saillie hors de la roche, le long de l'axe, en mètres */
  depth: number;
  /** Tête plate au-dessus de la voûte, en mètres au-dessus de sa clé ; `null` : cadre qui suit l'arc */
  head: number | null;
  /** Teintes alternées des faces : voussoirs pour la pierre */
  colors: string[];
}

/** Roc brut : aucun cadre, la façade de roche de `createTunnelRoofs` fait le portail. */
const PORTAL_SPECS: Record<Exclude<TunnelPortal, "rock">, PortalSpec> = {
  stone: { frame: 0.7, depth: 0.6, head: null, colors: ["#9c8a6c", "#8a785c"] },
  concrete: { frame: 1.2, depth: 0.9, head: 1.2, colors: ["#b5b2aa"] },
};

/**
 * Cadres des deux portails (PR-22) : l'intrados prolongé hors de la roche, une face avant et une face arrière.
 * Pierre : arc de voussoirs qui suit la voûte. Béton : tête rectangulaire au-dessus.
 */
export const portalGeometry = (
  points: Vec3[],
  edge: (i: number) => number,
  tunnel: StageTunnel,
): BufferGeometry | null => {
  if (tunnel.portal === "rock") return null;
  const spec = PORTAL_SPECS[tunnel.portal];
  const positions: number[] = [];
  const colors: number[] = [];
  const tints = spec.colors.map((c) => new Color(c));
  for (const [i, out] of [
    [tunnel.from, -1],
    [tunnel.to, 1],
  ] as const) {
    const { rx, rz, tx, tz } = frameAt(points, i);
    const inner = tunnelProfile(edge(i));
    const half = edge(i) + spec.frame;
    const top =
      TUNNEL_WALL_HEIGHT + TUNNEL_VAULT_RISE + spec.frame + (spec.head ?? 0);
    // Contour extérieur : l'arc épaissi pour la pierre, poussé depuis le centre jusqu'au rectangle pour le béton.
    const outer: [number, number][] =
      spec.head === null
        ? tunnelProfile(edge(i), spec.frame)
        : inner.map(([x, y]) => {
            if (y <= TUNNEL_WALL_HEIGHT) return [Math.sign(x) * half, y];
            const dy = y - TUNNEL_WALL_HEIGHT;
            const t = Math.min(
              Math.abs(x) > 1e-6 ? half / Math.abs(x) : Infinity,
              (top - TUNNEL_WALL_HEIGHT) / dy,
            );
            return [x * t, TUNNEL_WALL_HEIGHT + dy * t];
          });
    const at = (
      [lateral, height]: [number, number],
      axial: number,
    ): number[] => [
      points[i].x + rx * lateral + tx * out * axial,
      points[i].y + height,
      points[i].z + rz * lateral + tz * out * axial,
    ];
    const quad = (
      a: number[],
      b: number[],
      c: number[],
      d: number[],
      tint: Color,
    ) => {
      positions.push(...a, ...b, ...c, ...a, ...c, ...d);
      for (let k = 0; k < 6; k++) colors.push(tint.r, tint.g, tint.b);
    };
    for (let j = 0; j + 1 < inner.length; j++) {
      const tint = tints[j % tints.length];
      // Dessus du cadre enfoncé dans la roche ; l'intrados part du portail, sinon il double celui du tube.
      const back = -TUNNEL_COVER;
      // Intrados prolongé, face avant, dessus du cadre.
      quad(
        at(inner[j], 0),
        at(inner[j + 1], 0),
        at(inner[j + 1], spec.depth),
        at(inner[j], spec.depth),
        tint,
      );
      quad(
        at(inner[j], spec.depth),
        at(inner[j + 1], spec.depth),
        at(outer[j + 1], spec.depth),
        at(outer[j], spec.depth),
        tint,
      );
      quad(
        at(outer[j], spec.depth),
        at(outer[j + 1], spec.depth),
        at(outer[j + 1], back),
        at(outer[j], back),
        tint,
      );
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(Float32Array.from(positions), 3),
  );
  geometry.setAttribute(
    "color",
    new BufferAttribute(Float32Array.from(colors), 3),
  );
  geometry.computeVertexNormals();
  return geometry;
};

/** Une lampe tous les tant de points de l'axe (2 m chacun) : 12 m entre deux lampes */
const LAMP_EVERY = 6;
/** Profil de la voûte où pendent les deux bandes, de chaque côté de la clé */
const LAMP_SEGMENT = 2;
/** Largeur d'une lampe en travers, en part du segment de voûte, centrée dessus */
const LAMP_SPAN = 0.35;
/** Écart à l'intrados vers l'axe : la lampe ne se bat pas avec la voûte, en mètres */
const LAMP_INSET = 0.05;

/** Bandes de lampes (PR-23 B) : deux rangées de quads émissifs le long de la voûte, une lampe longue d'un point. */
export const lampsGeometry = (
  points: Vec3[],
  edge: (i: number) => number,
  tunnel: StageTunnel,
): BufferGeometry | null => {
  const positions: number[] = [];
  const at = (i: number, [lateral, height]: [number, number]): number[] => {
    const { rx, rz } = frameAt(points, i);
    return [
      points[i].x + rx * lateral,
      points[i].y + height,
      points[i].z + rz * lateral,
    ];
  };
  const across = (
    i: number,
    j: number,
  ): [[number, number], [number, number]] => {
    const profile = tunnelProfile(edge(i), -LAMP_INSET);
    const [a, b] = [profile[j], profile[j + 1]];
    // Centrée sur le segment : les deux rangées restent symétriques.
    const lerp = (t: number): [number, number] => [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
    ];
    return [lerp(0.5 - LAMP_SPAN / 2), lerp(0.5 + LAMP_SPAN / 2)];
  };
  // Indice dans le profil : 1 + segment depuis la paroi gauche, et son symétrique à droite.
  const rows = [1 + LAMP_SEGMENT, TUNNEL_VAULT_SEGMENTS - LAMP_SEGMENT];
  for (
    let i = tunnel.from + LAMP_EVERY / 2;
    i + 1 <= tunnel.to;
    i += LAMP_EVERY
  )
    for (const j of rows) {
      const [a0, b0] = across(i, j);
      const [a1, b1] = across(i + 1, j);
      const [p, q, r, s] = [at(i, a0), at(i, b0), at(i + 1, b1), at(i + 1, a1)];
      positions.push(...p, ...q, ...r, ...p, ...r, ...s);
    }
  if (positions.length === 0) return null;
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(Float32Array.from(positions), 3),
  );
  return geometry;
};
