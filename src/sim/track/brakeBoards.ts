// Panneaux de freinage (PR-6 du studio) : 3, 2 puis 1 chevrons avant un virage serré qui suit une longue ligne droite.
import { computePaceNotes, type PaceNote } from "./paceNotes";
import { SHOULDER_WIDTH } from "./ribbon";
import type { SceneryItem, SceneryKind, Track } from "../types";

/** Ligne droite minimale avant le virage, depuis la fin du virage ou de la chicane précédents, en mètres. À régler au volant. */
const APPROACH_MIN = 250;
/** Notes de virage qui reçoivent des panneaux : les plus serrées, où le freinage compte */
const MAX_GRADE = 3;
/** Un virage moins serré que ça ne coupe pas la ligne droite : on le passe pied au plancher */
const STRAIGHT_GRADE = 6;
/** Distances à l'entrée du virage, du premier panneau au dernier, en mètres */
const BOARDS: { distance: number; kind: SceneryKind }[] = [
  { distance: 150, kind: "brakeBoard3" },
  { distance: 100, kind: "brakeBoard2" },
  { distance: 50, kind: "brakeBoard1" },
];
/** Un panneau trop près du virage ou de la chicane d'avant gênerait leur sortie, en mètres */
const CLEAR_AFTER = 20;
/** Comme les annonces de chicane : écart au-delà du bas-côté, en mètres */
const SIDE_GAP = 0.8;
/** Collider : les deux poteaux et le panneau, une seule boîte, renversable comme les autres panneaux */
export const BRAKE_BOARD_COLLIDER_RADIUS = 0.1;

/** Ce qui interrompt une ligne droite : virage pris en freinant, chicane. */
const breaksStraight = (note: PaceNote): boolean =>
  (note.kind === "turn" && note.grade < STRAIGHT_GRADE) ||
  note.kind === "chicane";

/** Le panneau à `s`, côté extérieur du virage, face au pilote qui arrive dans le sens de l'axe. */
const boardAt = (
  { points, widths, indexAt, groundAt }: Track,
  s: number,
  kind: SceneryKind,
  turnRight: boolean,
): SceneryItem => {
  const i = indexAt(s);
  const a = points[Math.max(0, i - 1)];
  const b = points[Math.min(points.length - 1, i + 1)];
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const length = Math.sqrt(dx * dx + dz * dz) || 1;
  // Extérieur : à gauche avant un droite, à droite avant un gauche.
  const lateral =
    (turnRight ? -1 : 1) * (widths[i] / 2 + SHOULDER_WIDTH + SIDE_GAP);
  const x = points[i].x + (-dz / length) * lateral;
  const z = points[i].z + (dx / length) * lateral;
  const facing = Math.atan2(-dx, -dz);
  return {
    kind,
    position: { x, y: groundAt(x, z) ?? points[i].y, z },
    // Face avant : chevrons vers la droite. Dos : vers la gauche, donc un demi-tour pour un virage à gauche.
    yaw: turnRight ? facing : facing + Math.PI,
    scale: 1,
    colliderRadius: BRAKE_BOARD_COLLIDER_RADIUS,
  };
};

/**
 * Trois panneaux avant chaque virage noté 1 à 3 au bout d'une ligne droite d'au moins `APPROACH_MIN`.
 * Rien sur le circuit : ses temps restent les mêmes au bit près. Même tracé, mêmes panneaux.
 */
export const brakeBoardItems = (track: Track): SceneryItem[] => {
  if (track.closed) return [];
  const { notes } = computePaceNotes(track);
  const items: SceneryItem[] = [];
  let straightFrom = track.startS;
  for (const note of notes) {
    if (!breaksStraight(note)) continue;
    if (
      note.kind === "turn" &&
      note.grade <= MAX_GRADE &&
      note.startS - straightFrom >= APPROACH_MIN &&
      note.startS <= track.finishS
    )
      for (const { distance, kind } of BOARDS) {
        const s = note.startS - distance;
        if (s >= straightFrom + CLEAR_AFTER)
          items.push(boardAt(track, s, kind, note.direction === "right"));
      }
    straightFrom = Math.max(straightFrom, note.endS);
  }
  return items;
};
