import { type Ref, useId } from "react";
import type { Vec3 } from "@/sim/types";

const ROUND = { strokeLinecap: "round", strokeLinejoin: "round" } as const;

interface RoadProps {
  path: string;
  /** Épaisseur à l'écran en pixels */
  width: number;
  /** Unités du SVG par pixel. Pas de `non-scaling-stroke` : il passe les pointillés du parcouru en pixels et le décale. */
  scale: number;
  /** Tracé ambre du parcouru : `strokeDasharray` mis à jour par référence */
  doneRef: Ref<SVGPathElement>;
}

/** Route grise à venir, parcouru en ambre par-dessus, liseré noir pour se détacher du décor. */
export const Road = ({ path, width, scale, doneRef }: RoadProps) => (
  <>
    <path
      d={path}
      fill="none"
      stroke="black"
      strokeWidth={(width + 3) * scale}
      {...ROUND}
    />
    <path
      d={path}
      fill="none"
      stroke="#9ca3af"
      strokeWidth={width * scale}
      {...ROUND}
    />
    <path
      ref={doneRef}
      d={path}
      pathLength={1}
      fill="none"
      stroke="#fbbf24"
      strokeWidth={width * scale}
      strokeDasharray="0 1"
      strokeLinejoin="round"
    />
  </>
);

interface MarkersProps {
  start: Vec3;
  finish: Vec3;
  closed: boolean;
  unit: number;
}

/** Départ en vert, arrivée en damier. Sur le circuit, départ et arrivée se confondent. */
export const Markers = ({ start, finish, closed, unit }: MarkersProps) => {
  // Une carte globale et une vignette peuvent cohabiter, chacune avec son échelle de damier.
  const checker = useId();
  return (
    <>
      <defs>
        <pattern
          id={checker}
          width={unit * 2}
          height={unit * 2}
          patternUnits="userSpaceOnUse"
        >
          <rect width={unit * 2} height={unit * 2} fill="white" />
          <rect width={unit} height={unit} fill="black" />
          <rect x={unit} y={unit} width={unit} height={unit} fill="black" />
        </pattern>
      </defs>
      {!closed && (
        <rect
          x={finish.x - unit * 4}
          y={finish.z - unit * 3}
          width={unit * 8}
          height={unit * 6}
          fill={`url(#${checker})`}
          stroke="black"
          vectorEffect="non-scaling-stroke"
        />
      )}
      <circle
        cx={start.x}
        cy={start.z}
        r={unit * 3.5}
        fill="#22c55e"
        stroke="black"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
    </>
  );
};

interface GatesProps {
  gates: { x: number; z: number; angle: number }[];
  unit: number;
}

/** Un trait blanc en travers de la route à chaque intermédiaire, liseré noir. Statique : aucun coût pendant la course. */
export const Gates = ({ gates, unit }: GatesProps) => (
  <>
    {gates.map(({ x, z, angle }) => (
    <g key={`${x},${z}`} transform={`translate(${x} ${z}) rotate(${angle})`}>
      <line
        y1={-unit * 4}
        y2={unit * 4}
        stroke="black"
        strokeWidth={4}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <line
        y1={-unit * 4}
        y2={unit * 4}
        stroke="white"
        strokeWidth={2}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </g>
    ))}
  </>
);

/** Flèche pointée vers le haut, à tourner par `transform`. */
export const CarArrow = ({
  unit,
  arrowRef,
  transform,
}: {
  unit: number;
  arrowRef?: Ref<SVGPathElement>;
  transform?: string;
}) => (
  <path
    ref={arrowRef}
    transform={transform}
    d={`M0 ${-7 * unit}L${5 * unit} ${6 * unit}L0 ${3 * unit}L${-5 * unit} ${6 * unit}Z`}
    fill="#fbbf24"
    stroke="black"
    strokeWidth={1.5}
    strokeLinejoin="round"
    vectorEffect="non-scaling-stroke"
  />
);

/** Fantôme : un rond translucide, caché tant qu'il n'y a pas de fantôme. Placé par `ghostRef` à chaque image. */
export const GhostDot = ({
  unit,
  ghostRef,
}: {
  unit: number;
  ghostRef: Ref<SVGCircleElement>;
}) => (
  <circle
    ref={ghostRef}
    r={4 * unit}
    visibility="hidden"
    fill="white"
    fillOpacity={0.55}
    stroke="black"
    strokeOpacity={0.6}
    strokeWidth={1}
    vectorEffect="non-scaling-stroke"
  />
);
