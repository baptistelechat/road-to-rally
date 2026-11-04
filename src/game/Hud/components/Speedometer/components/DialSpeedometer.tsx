import {
  AMBER,
  formatGear,
  type GaugeData,
  RED,
  RED_ZONE,
  rpmRatio,
  TRACK,
} from "../gauge";

const MAX_KMH = 200;
const RED_KMH = 160;
const C = 80;
/** Cadran de 240°, ouvert en bas : 0 km/h en bas à gauche */
const START = 150;
const SWEEP = 240;
/** Anneau de régime, le long du bord */
const RING = "M15.92 117 A74 74 0 1 1 144.08 117";
const MUTED = "rgba(255,255,255,0.6)";
const TICKS = Array.from({ length: MAX_KMH / 10 + 1 }, (_, i) => i * 10);

const polar = (kmh: number, radius: number): [number, number] => {
  const angle =
    ((START + (SWEEP * Math.min(kmh, MAX_KMH)) / MAX_KMH) * Math.PI) / 180;
  return [C + Math.cos(angle) * radius, C + Math.sin(angle) * radius];
};

/**
 * Cadran rond façon Jaeger : aiguille de vitesse, anneau de régime autour.
 * De l'extérieur vers le centre : anneau, chiffres, graduations, aiguille. L'aiguille s'arrête avant les graduations.
 */
export const DialSpeedometer = ({ speedKmh, gear, rpm }: GaugeData) => {
  const ratio = rpmRatio(rpm);
  const [nx, ny] = polar(speedKmh, 44);
  return (
    <svg viewBox="0 0 160 160" className="size-44" aria-hidden="true">
      <path d={RING} fill="none" stroke={TRACK} strokeWidth={4} />
      <path
        d={RING}
        fill="none"
        stroke={ratio >= RED_ZONE ? RED : AMBER}
        strokeWidth={4}
        pathLength={100}
        strokeDasharray={`${Math.round(ratio * 1000) / 10} 100`}
      />
      {TICKS.map((kmh) => {
        const major = kmh % 20 === 0;
        const [x1, y1] = polar(kmh, 55);
        const [x2, y2] = polar(kmh, major ? 47 : 51);
        const [lx, ly] = polar(kmh, 63);
        return (
          <g key={kmh}>
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={kmh >= RED_KMH ? RED : "rgba(255,255,255,0.75)"}
              strokeWidth={major ? 2 : 1}
            />
            {kmh % 40 === 0 && (
              <text
                x={lx}
                y={ly + 3}
                textAnchor="middle"
                fill={MUTED}
                fontSize={8}
              >
                {kmh}
              </text>
            )}
          </g>
        );
      })}
      <line
        x1={C}
        y1={C}
        x2={nx}
        y2={ny}
        stroke="#f97316"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <circle cx={C} cy={C} r={7} fill="#222" stroke="#fff" strokeWidth={2} />
      <rect
        x={58}
        y={104}
        width={44}
        height={22}
        rx={3}
        fill="#000"
        stroke="rgba(255,255,255,0.3)"
      />
      <text
        x={C}
        y={121}
        textAnchor="middle"
        fill="#fff"
        fontSize={16}
        fontWeight={700}
        className="font-mono tabular-nums"
      >
        {speedKmh}
      </text>
      <text
        x={C}
        y={146}
        textAnchor="middle"
        fill={AMBER}
        fontSize={15}
        fontWeight={700}
        className="font-mono"
      >
        {formatGear(gear)}
      </text>
    </svg>
  );
};
