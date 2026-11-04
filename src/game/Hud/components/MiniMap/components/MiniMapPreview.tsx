import type { MiniMapStyle } from "@/game/copilotOptions";
import { CarArrow, Road } from "./Road";

/** Tracé fictif de la vignette, sur un carré de 48 */
const LOOP =
  "M10 30C6 14 22 6 30 12S42 10 40 24S30 42 20 40S12 36 10 30Z";
/** La même route vue en zoom, qui passe sous la voiture puis tourne à droite */
const ZOOMED = "M24 60L24 30C24 18 34 14 40 -8";

const Loop = ({ width }: { width: number }) => (
  <>
    <Road path={LOOP} width={width} scale={1} doneRef={null} />
    <CarArrow unit={0.3} transform="translate(10 30) rotate(-15)" />
  </>
);

const Zoomed = ({ rotation }: { rotation: number }) => (
  <g transform={`rotate(${rotation} 24 30)`}>
    <Road path={ZOOMED} width={5} scale={1} doneRef={null} />
    <CarArrow unit={0.5} transform="translate(24 30)" />
  </g>
);

/** Schéma de chaque style de mini-carte, pour le menu des options : la vraie carte demande une spéciale chargée. */
export const MiniMapPreview = ({
  style,
}: {
  style: MiniMapStyle | "off";
}) => (
  <svg
    viewBox="0 0 48 48"
    className="absolute top-1/2 left-1/2 size-20 -translate-1/2 rounded-sm bg-black/70"
  >
    {style === "off" && (
      <path
        d="M14 14L34 34M34 14L14 34"
        stroke="rgba(255,255,255,0.4)"
        strokeWidth={3}
        strokeLinecap="round"
      />
    )}
    {style === "global" && <Loop width={2.5} />}
    {style === "north" && (
      <>
        <Zoomed rotation={40} />
        <g transform="translate(40 8)">
          <circle r={5} fill="black" stroke="white" strokeOpacity={0.3} />
          <path d="M0 -4L1.5 0L-1.5 0Z" fill="#ef4444" />
          <path d="M0 4L1.5 0L-1.5 0Z" fill="#e5e7eb" />
        </g>
      </>
    )}
    {(style === "heading" || style === "hybrid") && <Zoomed rotation={0} />}
    {style === "hybrid" && (
      <g transform="translate(29 1) scale(0.38)">
        <rect
          width={48}
          height={48}
          rx={3}
          fill="black"
          stroke="white"
          strokeOpacity={0.3}
          strokeWidth={2}
        />
        <Loop width={3} />
      </g>
    )}
  </svg>
);
