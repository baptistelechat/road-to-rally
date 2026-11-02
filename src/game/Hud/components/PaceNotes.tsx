"use client";

import { useHudStore } from "@/game/hudStore";
import type { PaceGrade, PaceNote, PaceTurn } from "@/sim/track/paceNotes";

/** Du rouge au vert : la forme et le chiffre portent l'information, la couleur ne fait que la renforcer. */
const GRADE_COLOR: Record<PaceGrade, string> = {
  1: "#ef4444",
  2: "#f97316",
  3: "#f59e0b",
  4: "#eab308",
  5: "#84cc16",
  6: "#22c55e",
};
const OBSTACLE_COLOR = "#fbbf24";
/** Angle balayé par la flèche selon la note, en degrés */
const GRADE_SWEEP: Record<PaceGrade, number> = {
  1: 170,
  2: 135,
  3: 105,
  4: 80,
  5: 55,
  6: 30,
};
const ARC_LENGTH = 30;
const STEM = 6;
const HEAD_LENGTH = 11;
const HEAD_HALF_WIDTH = 7;
/** Centre de la zone de la flèche, au-dessus du chiffre */
const ARROW_CENTER = { x: 32, y: 25 };

interface ArrowShape {
  shaft: string;
  head: string;
}

/** Flèche qui tourne vers la droite, centrée dans sa zone. Vers la gauche, elle est retournée au dessin. */
const arrowOf = (grade: PaceGrade): ArrowShape => {
  const angle = (GRADE_SWEEP[grade] * Math.PI) / 180;
  const radius = ARC_LENGTH / angle;
  const endX = radius * (1 - Math.cos(angle));
  const endY = -radius * Math.sin(angle);
  const headingX = Math.sin(angle);
  const headingY = -Math.cos(angle);
  const tipX = endX + headingX * HEAD_LENGTH;
  const tipY = endY + headingY * HEAD_LENGTH;
  // Le haut de l'arc n'est atteint qu'au-delà du quart de tour.
  const top = Math.min(tipY, angle > Math.PI / 2 ? -radius : endY);
  const dx = ARROW_CENTER.x - Math.max(endX, tipX) / 2;
  const dy = ARROW_CENTER.y - (top + Math.max(STEM, tipY)) / 2;
  const at = (x: number, y: number): string =>
    `${(x + dx).toFixed(1)} ${(y + dy).toFixed(1)}`;
  const wing = (side: number): string =>
    at(
      endX + side * HEAD_HALF_WIDTH * -headingY,
      endY + side * HEAD_HALF_WIDTH * headingX,
    );
  return {
    shaft: `M${at(0, STEM)}L${at(0, 0)}A${radius.toFixed(1)} ${radius.toFixed(1)} 0 0 1 ${at(endX, endY)}`,
    head: `M${wing(1)}L${at(tipX, tipY)}L${wing(-1)}Z`,
  };
};

const ARROWS: Record<PaceGrade, ArrowShape> = {
  1: arrowOf(1),
  2: arrowOf(2),
  3: arrowOf(3),
  4: arrowOf(4),
  5: arrowOf(5),
  6: arrowOf(6),
};

const noteLabel = (note: PaceNote): string => {
  if (note.kind !== "turn") return note.kind === "crest" ? "Crête" : "Bosse";
  return [
    `${note.direction === "left" ? "Gauche" : "Droite"} ${note.grade}`,
    ...(note.long ? ["longue"] : []),
    ...(note.tightens ? ["se resserre"] : []),
  ].join(", ");
};

const TurnIcon = ({ note }: { note: PaceTurn }) => {
  const color = GRADE_COLOR[note.grade];
  const { shaft, head } = ARROWS[note.grade];
  return (
    <>
      <g
        transform={
          note.direction === "left" ? "translate(64 0) scale(-1 1)" : undefined
        }
      >
        <path d={shaft} fill="none" stroke={color} strokeWidth={6} />
        <path d={head} fill={color} />
      </g>
      <text
        x={32}
        y={70}
        textAnchor="middle"
        fontSize={26}
        fontWeight={700}
        fill="white"
        className="font-mono"
      >
        {note.grade}
      </text>
      <g fill="none" stroke="white" strokeWidth={3}>
        {note.long && <path d="M5 62H19M5 56V68M19 56V68" />}
        {note.tightens && <path d="M45 54L59 62L45 70" />}
      </g>
    </>
  );
};

const NoteIcon = ({ note }: { note: PaceNote }) => (
  <svg
    viewBox="0 0 64 76"
    role="img"
    aria-label={noteLabel(note)}
    className="h-18"
  >
    {note.kind === "turn" && <TurnIcon note={note} />}
    {note.kind === "crest" && (
      <path d="M6 56Q32 8 58 56Z" fill={OBSTACLE_COLOR} />
    )}
    {note.kind === "bump" && (
      <path
        d="M6 40Q19 4 32 40T58 40"
        fill="none"
        stroke={OBSTACLE_COLOR}
        strokeWidth={7}
      />
    )}
  </svg>
);

/** Bande en haut au centre, sur le ciel : sous le message de diagnostic, au-dessus du décompte de remise en piste. */
export const PaceNotes = () => {
  const notes = useHudStore((s) => s.paceNotes);
  const call = useHudStore((s) => s.paceCall);
  const enabled = useHudStore((s) => s.copilotOptions.paceIconsEnabled);
  return (
    <>
      <p aria-live="polite" className="sr-only">
        {call && <span key={call.id}>{call.text}</span>}
      </p>
      {enabled && notes.length > 0 && (
        <ol
          aria-label="Prochains virages"
          className="absolute top-14 left-1/2 flex -translate-x-1/2 gap-2"
        >
          {notes.map((note, i) => (
            <li
              key={`${note.kind}-${note.startS}`}
              className={`rounded-md border bg-black/80 p-1 ${i === 0 ? "border-white/70" : "border-white/15"}`}
            >
              <NoteIcon note={note} />
            </li>
          ))}
        </ol>
      )}
    </>
  );
};
