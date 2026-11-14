"use client";

import type { ReactNode } from "react";
import type { HudStyle, SpeedometerStyle } from "@/game/copilotOptions";
import { useHudStore } from "@/game/hudStore";
import { panel } from "../../hudStyles";
import { ArcSpeedometer } from "./components/ArcSpeedometer";
import { DialSpeedometer } from "./components/DialSpeedometer";
import { DigitalSpeedometer } from "./components/DigitalSpeedometer";
import { TelemetrySpeedometer } from "./components/TelemetrySpeedometer";
import { formatGear, type GaugeData, isRoundGauge } from "./gauge";

const GAUGES: Record<SpeedometerStyle, (data: GaugeData) => ReactNode> = {
  digital: DigitalSpeedometer,
  dial: DialSpeedometer,
  arc: ArcSpeedometer,
  telemetry: TelemetrySpeedometer,
};

const PREVIEW_DATA: GaugeData = {
  speedKmh: 112,
  gear: 3,
  rpm: 5600,
  throttle: 0.8,
  brake: 0,
};

/** Habillage du compteur selon le HUD : rond, intégré au tableau de bord, ou bloc télé. */
const frameClass = (style: SpeedometerStyle, hud: HudStyle): string => {
  if (isRoundGauge(style))
    return "rounded-full border-2 border-foreground/20 bg-background p-2";
  if (hud === "cockpit") return "";
  return "border-t-3 border-foreground bg-background";
};

/** Vignette du menu des options, en réduction du vrai compteur. */
export const SpeedometerPreview = ({ style }: { style: SpeedometerStyle }) => {
  const Gauge = GAUGES[style];
  return (
    <span
      className={`${panel} ${isRoundGauge(style) ? "rounded-full p-1" : ""} absolute top-1/2 left-1/2 -translate-1/2 scale-[0.42]`}
    >
      <Gauge {...PREVIEW_DATA} />
    </span>
  );
};

/** Le style se choisit dans les options ; la place dépend du HUD (tableau de bord ou coin bas droit). */
export const Speedometer = () => {
  const style = useHudStore((s) => s.copilotOptions.speedometerStyle);
  const hud = useHudStore((s) => s.copilotOptions.hudStyle);
  const speedKmh = useHudStore((s) => s.speedKmh);
  const gear = useHudStore((s) => s.gear);
  const rpm = useHudStore((s) => s.rpm);
  const throttle = useHudStore((s) => s.throttle);
  const brake = useHudStore((s) => s.brake);
  const Gauge = GAUGES[style];
  return (
    <section
      aria-label={`Compteur : ${speedKmh} km/h, rapport ${formatGear(gear)}`}
      className={frameClass(style, hud)}
    >
      <Gauge
        speedKmh={speedKmh}
        gear={gear}
        rpm={rpm}
        throttle={throttle}
        brake={brake}
        dash={hud === "cockpit"}
      />
    </section>
  );
};
