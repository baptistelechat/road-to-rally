import { label } from "../../../hudStyles";
import {
  formatGear,
  type GaugeData,
  GREEN,
  INK,
  RED,
  RED_ZONE,
  rpmRatio,
  TRACK,
} from "../gauge";

const Pedal = ({ value, color }: { value: number; color: string }) => (
  <div
    className="flex h-full w-2 items-end rounded-xs"
    style={{ background: TRACK }}
  >
    <div
      className="w-full rounded-xs"
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
      <div className="w-29">
        <span className={label}>km/h</span>
        <div className="font-mono text-5xl leading-none font-bold tabular-nums">
          {speedKmh}
        </div>
        <div
          className="mt-1.5 h-1 rounded-xs"
          style={{ background: TRACK }}
          aria-hidden="true"
        >
          <div
            className="h-full rounded-xs"
            style={{
              width: `${ratio * 100}%`,
              background: ratio >= RED_ZONE ? RED : INK,
            }}
          />
        </div>
      </div>
      <div className="flex w-14 items-center justify-center self-stretch border-l border-foreground/15 font-mono text-5xl leading-none font-bold text-brand">
        {formatGear(gear)}
      </div>
    </div>
  );
};
