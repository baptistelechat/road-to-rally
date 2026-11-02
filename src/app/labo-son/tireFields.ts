import type { TireSound } from "@/audio/tireVoice";

const DEMO_S = 3.2;

export const percent = (value: number): string => `${Math.round(value * 100)} %`;

export const FIELDS: {
  key: keyof TireSound;
  label: string;
  min: number;
  max: number;
  step: number;
  readout: (value: number) => string;
}[] = [
  {
    key: "level",
    label: "Volume",
    min: 0,
    max: 1.5,
    step: 0.01,
    readout: percent,
  },
  {
    key: "pitchHz",
    label: "Hauteur",
    min: 600,
    max: 4000,
    step: 10,
    readout: (value) => `${value} Hz`,
  },
  {
    key: "spread",
    label: "Écart des bandes",
    min: 1.05,
    max: 1.8,
    step: 0.01,
    readout: (value) => `× ${value.toFixed(2)}`,
  },
  {
    key: "sharpness",
    label: "Finesse",
    min: 3,
    max: 80,
    step: 1,
    readout: String,
  },
  {
    key: "riseHz",
    label: "Montée",
    min: 0,
    max: 800,
    step: 10,
    readout: (value) => `${value} Hz`,
  },
  {
    key: "chatter",
    label: "Irrégularité",
    min: 0,
    max: 1,
    step: 0.01,
    readout: percent,
  },
  {
    key: "threshold",
    label: "Seuil",
    min: 0.1,
    max: 0.9,
    step: 0.01,
    readout: percent,
  },
  {
    key: "breath",
    label: "Souffle",
    min: 0,
    max: 1,
    step: 0.01,
    readout: percent,
  },
];

/** Glissement de la démo : entrée en glisse, tenue irrégulière, puis retour à l'adhérence. */
export const demoSlip = (t: number, peak: number): number => {
  if (t >= DEMO_S) return 0;
  const envelope = Math.min(t / 0.3, 1) * Math.min((DEMO_S - t) / 0.6, 1);
  return peak * envelope * (0.85 + 0.15 * Math.sin(t * 7));
};
