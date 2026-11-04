"use client";

import type { ReactNode } from "react";
import type { SpeedometerStyle } from "@/game/copilotOptions";
import { useHudStore } from "@/game/hudStore";
import { panel } from "../../hudStyles";
import { ArcSpeedometer } from "./components/ArcSpeedometer";
import { DialSpeedometer } from "./components/DialSpeedometer";
import { DigitalSpeedometer } from "./components/DigitalSpeedometer";
import { TelemetrySpeedometer } from "./components/TelemetrySpeedometer";
import { formatGear, type GaugeData } from "./gauge";

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

/** Vignette du menu des options, en réduction du vrai compteur. */
export const SpeedometerPreview = ({ style }: { style: SpeedometerStyle }) => {
  const Gauge = GAUGES[style];
  const round = style === "arc" || style === "dial";
  return (
    <span
      className={`${panel} ${round ? "rounded-full p-1" : ""} absolute top-1/2 left-1/2 -translate-1/2 scale-[0.45]`}
    >
      <Gauge {...PREVIEW_DATA} />
    </span>
  );
};

/** En bas à droite. Le style se choisit dans les options. */
export const Speedometer = () => {
  const style = useHudStore((s) => s.copilotOptions.speedometerStyle);
  const speedKmh = useHudStore((s) => s.speedKmh);
  const gear = useHudStore((s) => s.gear);
  const rpm = useHudStore((s) => s.rpm);
  const throttle = useHudStore((s) => s.throttle);
  const brake = useHudStore((s) => s.brake);
  const Gauge = GAUGES[style];
  return (
    <section
      aria-label={`Compteur : ${speedKmh} km/h, rapport ${formatGear(gear)}`}
      className={`${panel} ${style === "arc" || style === "dial" ? "rounded-full p-1" : ""}`}
    >
      <Gauge
        speedKmh={speedKmh}
        gear={gear}
        rpm={rpm}
        throttle={throttle}
        brake={brake}
      />
    </section>
  );
};
