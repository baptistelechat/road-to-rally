import type { PaceGrade, PaceTurn } from "@/sim/track/paceNotes";
import { DISC, INK, PILL } from "./shape";

/** Du rouge au vert : la forme et le chiffre portent l'information, la couleur ne fait que la renforcer. */
const GRADE_COLOR: Record<PaceGrade, string> = {
  1: "#ef4444",
  2: "#f97316",
  3: "#f59e0b",
  4: "#eab308",
  5: "#84cc16",
  6: "#22c55e",
};
/** Angle balayé par la flèche selon la note, en degrés */
const GRADE_SWEEP: Record<PaceGrade, number> = {
  1: 170,
  2: 135,
  3: 105,
  4: 80,
  5: 55,
  6: 30,
};
/** Un virage qui se resserre tourne de ça en plus, sans dépasser `MAX_SWEEP` : au-delà, la flèche s'enroule. */
const TIGHTEN_EXTRA = 50;
const MAX_SWEEP = 190;
const HEAD_LENGTH = 10;
const HEAD_HALF_WIDTH = 6.5;
const STEM = 5;
const STEPS = 30;

interface ArrowShape {
  shaft: string;
  head: string;
}

/**
 * Flèche qui tourne vers la droite, centrée sur la pastille. Courbure constante, ou qui triple de l'entrée
 * à la pointe quand le virage se resserre. Vers la gauche, elle est retournée au dessin.
 */
const arrowOf = (sweepDeg: number, tightens: boolean): ArrowShape => {
  const length = tightens ? 26 : 24;
  const sweep = (sweepDeg * Math.PI) / 180;
  // Courbure k0 → 3·k0 : l'angle total vaut 2·k0·longueur.
  const k0 = tightens ? sweep / (2 * length) : sweep / length;
  const k1 = tightens ? 3 * k0 : k0;
  const points: [number, number][] = [[0, 0]];
  let x = 0;
  let y = 0;
  let heading = -Math.PI / 2;
  const ds = length / STEPS;
  for (let i = 0; i < STEPS; i++) {
    heading += (k0 + ((k1 - k0) * (i + 0.5)) / STEPS) * ds;
    x += Math.cos(heading) * ds;
    y += Math.sin(heading) * ds;
    points.push([x, y]);
  }
  const hx = Math.cos(heading);
  const hy = Math.sin(heading);
  const tip: [number, number] = [x + hx * HEAD_LENGTH, y + hy * HEAD_LENGTH];
  const all = [...points, tip, [0, STEM] as [number, number]];
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const dx = DISC.x - (Math.min(...xs) + Math.max(...xs)) / 2;
  const dy = DISC.y - (Math.min(...ys) + Math.max(...ys)) / 2;
  const at = ([px, py]: [number, number]): string =>
    `${(px + dx).toFixed(1)} ${(py + dy).toFixed(1)}`;
  const wing = (side: number): string =>
    at([x - side * HEAD_HALF_WIDTH * hy, y + side * HEAD_HALF_WIDTH * hx]);
  return {
    shaft: `M${at([0, STEM])}L${points.map(at).join("L")}`,
    head: `M${wing(1)}L${at(tip)}L${wing(-1)}Z`,
  };
};

const GRADES: PaceGrade[] = [1, 2, 3, 4, 5, 6];
/** Calculées une fois : la bande change plusieurs fois par seconde dans une enfilade. */
const ARROWS = Object.fromEntries(
  GRADES.flatMap((g) => [
    [`${g}`, arrowOf(GRADE_SWEEP[g], false)],
    [
      `${g}t`,
      arrowOf(Math.min(GRADE_SWEEP[g] + TIGHTEN_EXTRA, MAX_SWEEP), true),
    ],
  ]),
) as Record<string, ArrowShape>;

export const TurnIcon = ({ note }: { note: PaceTurn }) => {
  const exit = GRADE_COLOR[note.grade];
  const { shaft, head } =
    ARROWS[`${note.entryGrade}${note.tightens ? "t" : ""}`];
  const subscript = note.tightens && note.grade !== note.entryGrade;
  return (
    <>
      <path d={PILL} fill="rgb(0 0 0 / 0.82)" stroke={exit} strokeWidth={2} />
      <g
        transform={
          note.direction === "left" ? "translate(64 0) scale(-1 1)" : undefined
        }
      >
        <circle
          cx={DISC.x}
          cy={DISC.y}
          r={DISC.r}
          fill={GRADE_COLOR[note.entryGrade]}
        />
        {/* Moitié de sortie, du côté où tourne le virage */}
        {note.tightens && <path d="M32 7A25 25 0 0 1 32 57Z" fill={exit} />}
        <path
          d={shaft}
          fill="none"
          stroke={INK}
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d={head} fill={INK} />
      </g>
      <text
        x={subscript ? 74 : 76}
        y={note.long ? 36 : 44}
        textAnchor="middle"
        fontSize={note.long ? 26 : 30}
        fontWeight={700}
        fill="white"
        className="font-mono"
      >
        {note.entryGrade}
      </text>
      {subscript && (
        <text
          x={86}
          y={note.long ? 38 : 46}
          fontSize={note.long ? 14 : 16}
          fontWeight={700}
          fill={exit}
          className="font-mono"
        >
          {note.grade}
        </text>
      )}
      {note.long && (
        <>
          <rect x={61} y={42} width={30} height={13} rx={3} fill="white" />
          <text
            x={76}
            y={52}
            textAnchor="middle"
            fontSize={9}
            fontWeight={700}
            fill={INK}
            className="font-mono"
          >
            LONG
          </text>
        </>
      )}
    </>
  );
};
