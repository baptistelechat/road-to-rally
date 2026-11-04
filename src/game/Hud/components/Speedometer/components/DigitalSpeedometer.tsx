import { label } from "../../../hudStyles";
import {
  AMBER,
  formatGear,
  GREEN,
  type GaugeData,
  RED,
  RED_ZONE,
  rpmRatio,
  TRACK,
} from "../gauge";

const LEDS = 12;

const ledColor = (i: number): string => {
  const at = (i + 1) / LEDS;
  if (at > RED_ZONE) return RED;
  return at > RED_ZONE - 0.25 ? AMBER : GREEN;
};

/** Chiffres et barre de LED de régime, qui passe au rouge quand la boîte change de rapport. */
export const DigitalSpeedometer = ({ speedKmh, gear, rpm }: GaugeData) => {
  const lit = Math.round(rpmRatio(rpm) * LEDS);
  return (
    <div className="px-4 py-3">
      <div className="mb-2 flex gap-1" aria-hidden="true">
        {Array.from({ length: LEDS }, (_, i) => (
          <span
            key={i}
            className="h-1.5 flex-1 rounded-sm"
            style={{ background: i < lit ? ledColor(i) : TRACK }}
          />
        ))}
      </div>
      <div className="flex items-stretch gap-4">
        <div className="flex w-14 flex-col items-center justify-center border-r border-white/15 pr-4">
          <span className={label}>Rapport</span>
          <span className="font-mono text-4xl font-bold text-amber-400 tabular-nums">
            {formatGear(gear)}
          </span>
        </div>
        <div className="flex flex-col items-end justify-center">
          {/* 3 chiffres réservés : le panneau ne bouge pas en passant de 99 à 100 km/h */}
          <span className="w-[3ch] text-right font-mono text-6xl leading-none font-bold tabular-nums">
            {speedKmh}
          </span>
          <span className={`${label} mt-1`}>km/h</span>
        </div>
      </div>
    </div>
  );
};
