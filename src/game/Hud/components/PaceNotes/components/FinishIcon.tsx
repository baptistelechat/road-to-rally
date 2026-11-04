import { PILL } from "./shape";

/** L'arche d'arrivée vue du pilote remplit toute la pilule, comme une fenêtre sur la fin de la route. */
export const FinishIcon = () => (
  <>
    <defs>
      <pattern
        id="pace-finish-check"
        width={10}
        height={10}
        patternUnits="userSpaceOnUse"
      >
        <rect width={10} height={10} fill="white" />
        <rect width={5} height={5} fill="#111111" />
        <rect x={5} y={5} width={5} height={5} fill="#111111" />
      </pattern>
      <clipPath id="pace-finish-pill">
        <path d={PILL} />
      </clipPath>
    </defs>
    <g clipPath="url(#pace-finish-pill)">
      <rect width={112} height={66} fill="#9cc3e8" />
      <path d="M0 66V40H112V66Z" fill="#6b8f4e" />
      <path d="M40 66L53 40H59L72 66Z" fill="#555555" />
      <rect x={30} y={16} width={5} height={30} fill="#111111" />
      <rect x={77} y={16} width={5} height={30} fill="#111111" />
      <rect
        x={27}
        y={11}
        width={58}
        height={12}
        fill="url(#pace-finish-check)"
        stroke="#111111"
        strokeWidth={1}
      />
    </g>
    <path d={PILL} fill="none" stroke="white" strokeWidth={2.5} />
  </>
);
