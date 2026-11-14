import type { ReactNode } from "react";
import {
  SIGN_ART_BENDS,
  SIGN_ART_BORDER,
  SIGN_ART_FIELD,
  SIGN_ART_HEIGHT,
  SIGN_ART_RIM,
  SIGN_ART_WIDTH,
  type SignOutline,
} from "@/render/scenery/chicaneSignArt";
import type { PaceChicane } from "@/sim/track/paceNotes";
import { ARROW_SHIFT, HEX, TILE, TILE_BAR } from "./shape";

/**
 * Fond des obstacles, plus sombre que le rouge de la note 1. ponytail: hors tokens comme l'échelle des notes,
 * `destructive` (#ff6b5e en sombre) ne contraste pas assez sous le « ! » clair.
 */
const DANGER_COLOR = "#b91c1c";

/** Crête vue du pilote : la route monte et s'arrête sur le ciel. */
const CrestIcon = () => (
  <>
    <clipPath id="pace-crest-hex">
      <polygon points={HEX} />
    </clipPath>
    <g clipPath="url(#pace-crest-hex)">
      <path d="M0 72V38H72V72Z" fill={DANGER_COLOR} />
      <path d="M18 72L33 38H39L54 72Z" className="fill-foreground" />
      <path
        d="M36 70V42"
        stroke={DANGER_COLOR}
        strokeWidth={2.5}
        strokeDasharray="5 4"
      />
    </g>
  </>
);

/** Bosse : la voiture décolle d'un dos d'âne. */
const BumpIcon = () => (
  <g transform={ARROW_SHIFT}>
    <path
      d="M7 46H20Q32 32 44 46H57"
      fill="none"
      stroke={DANGER_COLOR}
      strokeWidth={5}
      strokeLinecap="round"
    />
    <g transform="translate(34 22) rotate(-8)" fill={DANGER_COLOR}>
      <path d="M-9 -1L-6 -6H5L8 -1Z" />
      <rect x={-10} y={-2} width={20} height={5} rx={1.5} />
      <circle cx={-6} cy={4} r={2.6} />
      <circle cx={6} cy={4} r={2.6} />
    </g>
    <path
      d="M22 30L16 34M20 24L13 25"
      stroke={DANGER_COLOR}
      strokeWidth={2.5}
      strokeLinecap="round"
    />
  </g>
);

/** Tuile rouge pleine, badge clair et « ! » : un danger posé sur la route */
const DangerTile = ({ children }: { children: ReactNode }) => (
  <>
    <polygon points={TILE} fill={DANGER_COLOR} />
    <polygon points={TILE_BAR} className="fill-foreground" />
    <polygon points={HEX} className="fill-foreground" />
    {children}
    <text
      x={94}
      y={50}
      textAnchor="middle"
      fontSize={40}
      className="fill-foreground font-mono"
    >
      !
    </text>
  </>
);

export const ObstacleIcon = ({ kind }: { kind: "crest" | "bump" }) => (
  <DangerTile>{kind === "crest" ? <CrestIcon /> : <BumpIcon />}</DangerTile>
);

const toPoints = (outline: SignOutline): string =>
  outline.map(([x, y]) => `${x},${y}`).join(" ");

/**
 * Le panneau triangulaire du bord de route, dans le badge. Rouge et noir du vrai panneau, pas de la DA.
 * Dessiné pour un premier virage à droite, l'autre sens en est le miroir. `firstBend` : `chicaneFirstBend`, pas le côté libre.
 */
export const ChicaneIcon = ({
  firstBend,
}: {
  firstBend: PaceChicane["direction"];
}) => (
  <DangerTile>
    <svg
      x={13}
      y={12}
      width={46}
      height={41}
      viewBox={`0 0 ${SIGN_ART_WIDTH} ${SIGN_ART_HEIGHT}`}
    >
      <g
        transform={
          firstBend === "left"
            ? `translate(${SIGN_ART_WIDTH} 0) scale(-1 1)`
            : undefined
        }
      >
        <polygon
          points={toPoints(SIGN_ART_RIM)}
          className="fill-foreground"
        />
        <polygon points={toPoints(SIGN_ART_BORDER)} fill="#dc2626" />
        <polygon
          points={toPoints(SIGN_ART_FIELD)}
          className="fill-foreground"
        />
        <polygon points={toPoints(SIGN_ART_BENDS)} fill="#111111" />
      </g>
    </svg>
  </DangerTile>
);
