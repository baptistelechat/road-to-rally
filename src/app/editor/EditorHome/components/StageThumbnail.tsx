import type { LatLon } from "@/geo/gpx";
import { assembleTrace } from "@/editor/trace";
import type { EditorTrace } from "@/editor/types";
import { cn } from "@/lib/utils";

const WIDTH = 380;
const HEIGHT = 150;
const PADDING = 20;
/** Une vignette n'a pas besoin de chaque mètre de route */
const MAX_POINTS = 200;

/** Le tracé vu du dessus, cadré dans la vignette : la longitude est corrigée de la latitude. */
const project = (points: LatLon[]): [number, number][] => {
  const step = Math.max(1, Math.ceil(points.length / MAX_POINTS));
  const kept = points.filter(
    (_, i) => i % step === 0 || i === points.length - 1,
  );
  const scaleX = Math.cos((kept[0].lat * Math.PI) / 180);
  const xs = kept.map(({ lon }) => lon * scaleX);
  const ys = kept.map(({ lat }) => -lat);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX || 1e-9;
  const spanY = Math.max(...ys) - minY || 1e-9;
  const scale = Math.min(
    (WIDTH - 2 * PADDING) / spanX,
    (HEIGHT - 2 * PADDING) / spanY,
  );
  const offsetX = (WIDTH - spanX * scale) / 2;
  const offsetY = (HEIGHT - spanY * scale) / 2;
  return xs.map((x, i) => [
    offsetX + (x - minX) * scale,
    offsetY + (ys[i] - minY) * scale,
  ]);
};

interface StageThumbnailProps {
  /** Absent : spéciale importée, sans tracé gardé */
  trace: EditorTrace | null;
  /** L'axe de la route, dessiné à défaut de tracé */
  outline?: LatLon[];
  /** En jaune : le tracé porte des changements à rouler */
  highlighted?: boolean;
  /** Un brouillon : trait en pointillés */
  dashed?: boolean;
  className?: string;
}

export const StageThumbnail = ({
  trace,
  outline = [],
  highlighted = false,
  dashed = false,
  className,
}: StageThumbnailProps) => {
  const points = trace
    ? trace.segments.length > 0
      ? assembleTrace(trace)
      : trace.anchors.map(({ position }) => position)
    : outline;
  const drawn = points.length >= 2 ? project(points) : [];
  const first = drawn[0];
  const last = drawn[drawn.length - 1];
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      aria-hidden="true"
      className={cn("block bg-muted", className)}
    >
      {first && last && (
        <>
          <polyline
            points={drawn
              .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
              .join(" ")}
            fill="none"
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={dashed ? "10 8" : undefined}
            className={highlighted ? "stroke-brand" : "stroke-muted-foreground"}
          />
          <circle
            cx={first[0]}
            cy={first[1]}
            r={7}
            className="fill-foreground"
          />
          <rect
            x={last[0] - 6}
            y={last[1] - 6}
            width={12}
            height={12}
            className="fill-foreground"
          />
        </>
      )}
    </svg>
  );
};
