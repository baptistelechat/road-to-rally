import { carConfig } from "@/sim/carConfig";
import type { SpeedometerStyle } from "@/game/copilotOptions";

const { idleRpm, redlineRpm, upshiftRpm } = carConfig.engine;

export interface GaugeData {
  speedKmh: number;
  gear: number;
  rpm: number;
  throttle: number;
  brake: number;
  /** Intégré au tableau de bord Cockpit : LED facettées */
  dash?: boolean;
}

// Tokens de globals.css, passés en `style` : un attribut SVG `fill="var(…)"` n'est pas lu partout.
export const BRAND = "var(--brand)";
export const BRAND_FOREGROUND = "var(--brand-foreground)";
export const RED = "var(--destructive)";
export const GREEN = "var(--chart-4)";
export const NEEDLE = "var(--chart-3)";
export const INK = "var(--foreground)";
export const BASE = "var(--background)";
export const MUTED = "var(--muted-foreground)";
export const TRACK = "color-mix(in oklab, var(--foreground) 12%, transparent)";
export const TICK = "color-mix(in oklab, var(--foreground) 75%, transparent)";
export const RIM = "color-mix(in oklab, var(--foreground) 30%, transparent)";

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

/** Cadran et Arc : ronds, au bout du tableau de bord en Cockpit */
export const isRoundGauge = (style: SpeedometerStyle): boolean =>
  style === "arc" || style === "dial";
