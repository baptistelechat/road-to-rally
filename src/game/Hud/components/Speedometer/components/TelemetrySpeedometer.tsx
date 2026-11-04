import { label } from "../../../hudStyles";
import {
  formatGear,
  type GaugeData,
  GREEN,
  RED,
  RED_ZONE,
  rpmRatio,
  TRACK,
} from "../gauge";

const Pedal = ({ value, color }: { value: number; color: string }) => (
  <div
    className="flex h-full w-2 items-end rounded-sm"
    style={{ background: TRACK }}
  >
    <div
      className="w-full rounded-sm"
      style={{ height: `${value * 100}%`, background: color }}
    />
  </div>
);

/** Télémétrie façon retransmission : pédales, vitesse, filet de régime. */
export const TelemetrySpeedometer = ({
  speedKmh,
  gear,
  rpm,
  throttle,
  brake,
}: GaugeData) => {
  const ratio = rpmRatio(rpm);
  return (
    <div className="flex items-end gap-3 px-3 py-2.5">
      <div className="flex h-16 gap-1" aria-hidden="true">
        <Pedal value={throttle} color={GREEN} />
        <Pedal value={brake} color={RED} />
      </div>
      <div className="w-28">
        <span className={label}>km/h</span>
        <div className="font-mono text-5xl leading-none font-bold tabular-nums">
          {speedKmh}
        </div>
        <div
          className="mt-1.5 h-1 rounded-sm"
          style={{ background: TRACK }}
          aria-hidden="true"
        >
          <div
            className="h-full rounded-sm"
            style={{
              width: `${ratio * 100}%`,
              background: ratio >= RED_ZONE ? RED : "#fff",
            }}
          />
        </div>
      </div>
      <div className="self-stretch border-l border-white/15 pl-3 font-mono text-5xl leading-none font-bold text-amber-400">
        {formatGear(gear)}
      </div>
    </div>
  );
};
