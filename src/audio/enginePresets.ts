// Les trois caractères de moteur écoutés dans le labo son, et la forme d'onde d'un cycle complet.

export type EnginePresetId = "atmo" | "turbo" | "five";

export const DEFAULT_ENGINE: EnginePresetId = "turbo";

export interface EnginePulse {
  /** Force de l'explosion : aucun cylindre ne pousse exactement comme un autre */
  amp: number;
  /** Décalage dans le cycle, en fraction de l'intervalle entre deux explosions */
  offset: number;
}

export interface EnginePreset {
  id: EnginePresetId;
  label: string;
  /** Une impulsion par cylindre, dans l'ordre d'allumage */
  pulses: EnginePulse[];
  /** Durée d'une impulsion, en fraction de l'intervalle entre deux explosions */
  pulseDecay: number;
  /** Oscillations par impulsion : plus il y en a, plus le son est aigu */
  pulseRing: number;
  /** Résonances fixes de l'échappement */
  resonances: { hz: number; q: number; gain: number }[];
  body: { closedHz: number; revHz: number; loadHz: number };
  /** Force de la saturation à pleine charge */
  drive: number;
  /** Instabilité du régime, en cents */
  wobbleCents: number;
  intake: { hz: number; q: number; level: number };
  mechanical: { hz: number; level: number; whineOrder: number; whine: number };
  overrun: { hz: number; level: number };
  pops: { minRpm: number; perSecond: number; hz: number; level: number };
  turbo: {
    minHz: number;
    maxHz: number;
    whistle: number;
    blowOff: number;
    /** Constante de temps de la montée en pression, en secondes */
    spoolS: number;
  } | null;
}

const pulses = (amps: number[], offsets: number[]): EnginePulse[] =>
  amps.map((amp, index) => ({ amp, offset: offsets[index] }));

export const ENGINE_PRESETS: readonly EnginePreset[] = [
  {
    id: "atmo",
    label: "4 cylindres atmo",
    pulses: pulses([1, 0.95, 1.04, 0.92], [0, 0.015, -0.012, 0.008]),
    pulseDecay: 0.32,
    pulseRing: 2.6,
    resonances: [
      { hz: 310, q: 2.4, gain: 0.5 },
      { hz: 820, q: 2.8, gain: 0.55 },
      { hz: 2100, q: 2, gain: 0.32 },
    ],
    body: { closedHz: 900, revHz: 1800, loadHz: 2200 },
    drive: 2.2,
    wobbleCents: 7,
    intake: { hz: 1900, q: 1.4, level: 0.16 },
    mechanical: { hz: 4200, level: 0.035, whineOrder: 14, whine: 0.012 },
    overrun: { hz: 620, level: 0.5 },
    pops: { minRpm: 3800, perSecond: 0.8, hz: 900, level: 0.34 },
    turbo: null,
  },
  {
    id: "turbo",
    label: "4 cylindres turbo",
    pulses: pulses([1, 0.9, 1.06, 0.88], [0, 0.02, -0.018, 0.012]),
    pulseDecay: 0.42,
    pulseRing: 1.7,
    resonances: [
      { hz: 170, q: 1.8, gain: 0.7 },
      { hz: 460, q: 2.2, gain: 0.5 },
      { hz: 1250, q: 1.6, gain: 0.22 },
    ],
    body: { closedHz: 620, revHz: 1100, loadHz: 1500 },
    drive: 3,
    wobbleCents: 10,
    intake: { hz: 1300, q: 1, level: 0.09 },
    mechanical: { hz: 3600, level: 0.04, whineOrder: 19, whine: 0.016 },
    overrun: { hz: 480, level: 0.6 },
    pops: { minRpm: 3000, perSecond: 3.2, hz: 620, level: 0.55 },
    turbo: {
      minHz: 1500,
      maxHz: 5000,
      whistle: 0.04,
      blowOff: 0.28,
      spoolS: 0.45,
    },
  },
  {
    id: "five",
    label: "5 cylindres",
    // Les collecteurs inégaux de l'ordre 1-2-4-5-3 font le grondement irrégulier de ce moteur.
    pulses: pulses([1, 0.72, 0.96, 0.66, 0.86], [0, 0.07, -0.05, 0.09, -0.04]),
    pulseDecay: 0.38,
    pulseRing: 1.9,
    resonances: [
      { hz: 210, q: 2, gain: 0.72 },
      { hz: 540, q: 2.6, gain: 0.55 },
      { hz: 1500, q: 1.8, gain: 0.24 },
    ],
    body: { closedHz: 700, revHz: 1300, loadHz: 1700 },
    drive: 2.6,
    wobbleCents: 12,
    intake: { hz: 1500, q: 1.2, level: 0.12 },
    mechanical: { hz: 3800, level: 0.04, whineOrder: 16, whine: 0.018 },
    overrun: { hz: 520, level: 0.58 },
    pops: { minRpm: 3200, perSecond: 1.8, hz: 720, level: 0.46 },
    turbo: {
      minHz: 1200,
      maxHz: 3600,
      whistle: 0.018,
      blowOff: 0.14,
      spoolS: 0.7,
    },
  },
];

export const enginePreset = (id: EnginePresetId): EnginePreset =>
  ENGINE_PRESETS.find((preset) => preset.id === id) ?? ENGINE_PRESETS[0];

const CYCLE_SAMPLES = 2048;
/** À 900 tr/min, un cycle dure 133 ms : il faut 256 harmoniques pour monter jusqu'à 1 900 Hz. */
const CYCLE_HARMONICS = 256;

/**
 * Pression à l'échappement sur un cycle complet (deux tours) : une impulsion amortie par cylindre.
 * `spread` amplifie les écarts entre cylindres, pour obtenir deux variantes qui battent entre elles.
 */
export const buildCycle = (preset: EnginePreset, spread = 1): Float64Array => {
  const cycle = new Float64Array(CYCLE_SAMPLES);
  const count = preset.pulses.length;
  const interval = 1 / count;
  preset.pulses.forEach((pulse, cylinder) => {
    const amp = 1 + (pulse.amp - 1) * spread;
    const start = (cylinder + pulse.offset * spread) * interval;
    for (let i = 0; i < CYCLE_SAMPLES; i++) {
      const position = (i / CYCLE_SAMPLES - start + 2) % 1;
      const elapsed = position / interval;
      cycle[i] +=
        amp *
        Math.exp(-elapsed / preset.pulseDecay) *
        Math.sin(2 * Math.PI * preset.pulseRing * elapsed);
    }
  });
  return cycle;
};

/** Coefficients de Fourier du cycle, au format de `createPeriodicWave` (l'indice 0 est le continu, ignoré). */
export const cycleSpectrum = (
  cycle: Float64Array,
): { real: Float32Array<ArrayBuffer>; imag: Float32Array<ArrayBuffer> } => {
  const real = new Float32Array(CYCLE_HARMONICS + 1);
  const imag = new Float32Array(CYCLE_HARMONICS + 1);
  const size = cycle.length;
  for (let harmonic = 1; harmonic <= CYCLE_HARMONICS; harmonic++) {
    let a = 0;
    let b = 0;
    const step = (2 * Math.PI * harmonic) / size;
    for (let i = 0; i < size; i++) {
      a += cycle[i] * Math.cos(step * i);
      b += cycle[i] * Math.sin(step * i);
    }
    real[harmonic] = (2 * a) / size;
    imag[harmonic] = (2 * b) / size;
  }
  return { real, imag };
};
