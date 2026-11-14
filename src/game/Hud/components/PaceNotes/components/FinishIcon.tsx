import { TILE } from "./shape";

/** L'arche d'arrivée vue du pilote remplit toute la tuile, comme une fenêtre sur la fin de la route. Couleurs du décor 3D, pas de la DA. */
export const FinishIcon = () => (
  <>
    <defs>
      <pattern
        id="pace-finish-check"
        width={10}
        height={10}
        patternUnits="userSpaceOnUse"
      >
        <rect width={10} height={10} fill="#ffffff" />
        <rect width={5} height={5} fill="#111111" />
        <rect x={5} y={5} width={5} height={5} fill="#111111" />
      </pattern>
      <clipPath id="pace-finish-tile">
        <polygon points={TILE} />
      </clipPath>
    </defs>
    <g clipPath="url(#pace-finish-tile)">
      <rect width={136} height={72} fill="#9cc3e8" />
      <polygon points="0,72 0,44 136,44 136,72" fill="#6b8f4e" />
      <polygon points="48,72 64,44 72,44 88,72" fill="#555555" />
      <rect x={36} y={16} width={6} height={34} fill="#111111" />
      <rect x={94} y={16} width={6} height={34} fill="#111111" />
      <rect
        x={32}
        y={10}
        width={72}
        height={14}
        fill="url(#pace-finish-check)"
        stroke="#111111"
        strokeWidth={1}
      />
    </g>
    <polygon
      points={TILE}
      fill="none"
      strokeWidth={2.5}
      className="stroke-foreground"
    />
  </>
);
