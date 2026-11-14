import { carConfig } from "@/sim/carConfig";
import {
  BRAND,
  BRAND_FOREGROUND,
  formatGear,
  type GaugeData,
  INK,
  MUTED,
  RED,
  RED_ZONE,
  rpmRatio,
  TRACK,
} from "../gauge";

const C = 80;
const R = 66;
/** Arc de 270°, ouvert en bas */
const ARC = "M33.33 126.67 A66 66 0 1 1 126.67 126.67";
const THOUSANDS = Array.from(
  { length: Math.floor(carConfig.engine.redlineRpm / 1000) },
  (_, i) => i + 1,
);

const onArc = (ratio: number, radius: number): [number, number] => {
  const angle = ((135 + 270 * ratio) * Math.PI) / 180;
  return [C + Math.cos(angle) * radius, C + Math.sin(angle) * radius];
};

/** Arc de régime gradué en milliers de tours, qui vire au rouge au passage du rapport. */
export const ArcSpeedometer = ({ speedKmh, gear, rpm }: GaugeData) => {
  const ratio = rpmRatio(rpm);
  const fill = Math.round(ratio * 1000) / 10;
  const red = Math.round(RED_ZONE * 1000) / 10;
  return (
    <svg viewBox="0 0 160 160" className="size-44 font-mono" aria-hidden="true">
      <path
        d={ARC}
        fill="none"
        style={{ stroke: TRACK }}
        strokeWidth={10}
        strokeLinecap="round"
      />
      <path
        d={ARC}
        fill="none"
        style={{ stroke: RED }}
        strokeOpacity={0.45}
        strokeWidth={10}
        strokeLinecap="round"
        pathLength={100}
        // Trou du ralenti au passage du rapport, puis trait jusqu'au bout : l'embout rond rejoint celui du fond.
        strokeDasharray={`${100 - red} ${red}`}
        strokeDashoffset={100 - red}
      />
      <path
        d={ARC}
        fill="none"
        style={{ stroke: ratio >= RED_ZONE ? RED : BRAND }}
        strokeWidth={10}
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray={`${fill} 100`}
      />
      {THOUSANDS.map((k) => {
        const [x, y] = onArc(rpmRatio(k * 1000), R - 15);
        return (
          <text
            key={k}
            x={x}
            y={y + 3}
            textAnchor="middle"
            style={{ fill: MUTED }}
            fontSize={8}
          >
            {k}
          </text>
        );
      })}
      <text
        x={C}
        y={90}
        textAnchor="middle"
        style={{ fill: INK }}
        fontSize={34}
        fontWeight={700}
        className="tabular-nums"
      >
        {speedKmh}
      </text>
      <text
        x={C}
        y={103}
        textAnchor="middle"
        style={{ fill: MUTED }}
        fontSize={8}
        letterSpacing={2}
      >
        KM/H
      </text>
      <text
        x={C}
        y={155}
        textAnchor="middle"
        style={{ fill: MUTED }}
        fontSize={7}
        letterSpacing={1}
      >
        ×1000 TR/MIN
      </text>
      <rect
        x={66}
        y={116}
        width={28}
        height={24}
        rx={5}
        style={{ fill: BRAND }}
      />
      <text
        x={C}
        y={134}
        textAnchor="middle"
        style={{ fill: BRAND_FOREGROUND }}
        fontSize={17}
        fontWeight={700}
      >
        {formatGear(gear)}
      </text>
    </svg>
  );
};
