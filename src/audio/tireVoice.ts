// Voix des pneus sur l'asphalte : le souffle du dérapage et, par-dessus, le crissement.
// Le crissement part d'un bruit filtré sur quelques bandes étroites, à hauteur quasi fixe : une note qui glisse ou qui tremble miaule.
import { randomSignal } from "./engineVoice";

export interface TireSound {
  /** Volume du crissement */
  level: number;
  /** Hauteur de la bande principale, en Hz */
  pitchHz: number;
  /** Rapport entre deux bandes voisines */
  spread: number;
  /** Finesse des bandes : basse = rugueux, haute = sifflé */
  sharpness: number;
  /** Montée de la hauteur en pleine glisse, en Hz */
  riseHz: number;
  /** Variations irrégulières du volume, 0 à 1 */
  chatter: number;
  /** Glissement à partir duquel le crissement démarre, 0 à 1 */
  threshold: number;
  /** Volume du souffle de dérapage */
  breath: number;
}

export const TIRE_TIMBRES: { label: string; sound: TireSound }[] = [
  {
    label: "Sec",
    sound: {
      level: 0.4,
      pitchHz: 1900,
      spread: 1.27,
      sharpness: 28,
      riseHz: 120,
      chatter: 0.5,
      threshold: 0.4,
      breath: 0.3,
    },
  },
  {
    label: "Aigu",
    sound: {
      level: 0.3,
      pitchHz: 2600,
      spread: 1.19,
      sharpness: 40,
      riseHz: 80,
      chatter: 0.35,
      threshold: 0.45,
      breath: 0.3,
    },
  },
  {
    label: "Rauque",
    sound: {
      level: 0.4,
      pitchHz: 1200,
      spread: 1.41,
      sharpness: 12,
      riseHz: 150,
      chatter: 0.8,
      threshold: 0.35,
      breath: 0.24,
    },
  },
];

export const DEFAULT_TIRE_SOUND = TIRE_TIMBRES[2].sound;

/** Écrit un paramètre audio ; c'est l'appelant qui décide s'il limite les ordres. */
export type ParamWriter = (
  param: AudioParam,
  value: number,
  timeConstant: number,
) => void;

export interface TireVoice {
  update: (asphaltSlip: number, speed: number) => void;
  setSound: (sound: TireSound) => void;
  dispose: () => void;
}

const BAND_WEIGHTS = [1, 0.6, 0.35];
const NOISE_S = 2;
const CHATTER_S = 5;
const CHATTER_HZ = 16;
/** Une bande étroite laisse passer peu de bruit : plus elle est fine, plus il faut la remonter. */
const BAND_MAKEUP = 0.6;
const CHATTER_DEPTH = 0.7;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const ramp = (low: number, high: number, value: number): number =>
  clamp01((value - low) / (high - low));

export const breathAmount = (asphaltSlip: number, speed: number): number =>
  ramp(0.25, 0.95, asphaltSlip) * ramp(1.5, 8, speed);

/** Force du crissement, 0 à 1 : il part après le souffle, quand le pneu glisse franchement. */
export const squealAmount = (
  asphaltSlip: number,
  speed: number,
  threshold: number,
): number =>
  ramp(threshold, threshold + 0.45, asphaltSlip) * ramp(3, 10, speed);

export const createTireVoice = (
  ctx: BaseAudioContext,
  output: AudioNode,
  write: ParamWriter,
  initial: TireSound = DEFAULT_TIRE_SOUND,
): TireVoice => {
  let sound = initial;
  const nodes: AudioNode[] = [];
  const gainNode = (value: number, target: AudioNode): GainNode => {
    const node = ctx.createGain();
    node.gain.value = value;
    node.connect(target);
    nodes.push(node);
    return node;
  };
  const bandpass = (
    frequency: number,
    q: number,
    target: AudioNode,
  ): BiquadFilterNode => {
    const node = ctx.createBiquadFilter();
    node.type = "bandpass";
    node.frequency.value = frequency;
    node.Q.value = q;
    node.connect(target);
    nodes.push(node);
    return node;
  };
  const loop = (buffer: AudioBuffer): AudioBufferSourceNode => {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.start();
    nodes.push(source);
    return source;
  };

  // Un point par échantillon : du bruit blanc.
  const noise = loop(randomSignal(ctx, NOISE_S, ctx.sampleRate));

  const breathGain = gainNode(0, output);
  const breathFilter = bandpass(1400, 2.2, breathGain);
  noise.connect(breathFilter);

  const squealGain = gainNode(0, output);
  const chatterGain = gainNode(1, squealGain);
  const bands = BAND_WEIGHTS.map((weight, i) => {
    const filter = bandpass(
      sound.pitchHz * sound.spread ** i,
      sound.sharpness,
      gainNode(weight, chatterGain),
    );
    noise.connect(filter);
    return filter;
  });

  const chatter = loop(randomSignal(ctx, CHATTER_S, CHATTER_HZ));
  const chatterDepth = ctx.createGain();
  chatterDepth.gain.value = 0;
  chatterDepth.connect(chatterGain.gain);
  chatter.connect(chatterDepth);
  nodes.push(chatterDepth);

  return {
    update: (asphaltSlip, speed) => {
      const breath = breathAmount(asphaltSlip, speed);
      write(breathGain.gain, breath * sound.breath, 0.05);
      write(breathFilter.frequency, 1100 + breath * 1200, 0.08);

      const squeal = squealAmount(asphaltSlip, speed, sound.threshold);
      const makeup = BAND_MAKEUP * Math.sqrt(sound.sharpness);
      write(squealGain.gain, squeal * sound.level * makeup, 0.06);
      bands.forEach((band, i) => {
        write(
          band.frequency,
          (sound.pitchHz + squeal * sound.riseHz) * sound.spread ** i,
          0.1,
        );
        write(band.Q, sound.sharpness, 0.1);
      });
      write(chatterDepth.gain, sound.chatter * CHATTER_DEPTH, 0.1);
    },
    setSound: (next) => {
      sound = next;
    },
    dispose: () => {
      noise.stop();
      chatter.stop();
      for (const node of nodes) node.disconnect();
    },
  };
};
