import { DISC, PILL } from "./shape";

/** Fond des obstacles : plus sombre que le rouge de la note 1, et en pilule pleine */
const DANGER_COLOR = "#b91c1c";

/** Crête vue du pilote : la route monte et s'arrête sur le ciel. */
const CrestIcon = () => (
  <>
    <clipPath id="pace-crest-disc">
      <circle cx={DISC.x} cy={DISC.y} r={DISC.r} />
    </clipPath>
    <g clipPath="url(#pace-crest-disc)">
      <path d="M0 64V34H64V64Z" fill={DANGER_COLOR} />
      <path d="M14 64L29 34H35L50 64Z" fill="white" />
      <path
        d="M32 62V38"
        stroke={DANGER_COLOR}
        strokeWidth={2.5}
        strokeDasharray="5 4"
      />
    </g>
  </>
);

/** Bosse : la voiture décolle d'un dos d'âne. */
const BumpIcon = () => (
  <>
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
  </>
);

export const ObstacleIcon = ({ kind }: { kind: "crest" | "bump" }) => (
  <>
    <path d={PILL} fill={DANGER_COLOR} stroke="white" strokeWidth={3} />
    <circle cx={DISC.x} cy={DISC.y} r={DISC.r} fill="white" />
    {kind === "crest" ? <CrestIcon /> : <BumpIcon />}
    <text
      x={78}
      y={46}
      textAnchor="middle"
      fontSize={36}
      fontWeight={700}
      fill="white"
      className="font-mono"
    >
      !
    </text>
  </>
);
