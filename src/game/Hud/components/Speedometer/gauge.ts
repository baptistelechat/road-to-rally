import { carConfig } from "@/sim/carConfig";

const { idleRpm, redlineRpm, upshiftRpm } = carConfig.engine;

export interface GaugeData {
  speedKmh: number;
  gear: number;
  rpm: number;
  throttle: number;
  brake: number;
}

export const AMBER = "#fbbf24";
export const RED = "#ef4444";
export const GREEN = "#22c55e";
export const TRACK = "rgba(255,255,255,0.12)";

export const formatGear = (gear: number): string => {
  if (gear < 0) return "R";
  if (gear === 0) return "N";
  return String(gear);
};

/** Régime ramené de 0 (ralenti) à 1 (rupteur) */
export const rpmRatio = (rpm: number): number =>
  Math.min(1, Math.max(0, (rpm - idleRpm) / (redlineRpm - idleRpm)));

/** Début de la zone rouge : là où la boîte passe le rapport */
export const RED_ZONE = rpmRatio(upshiftRpm);