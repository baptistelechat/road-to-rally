// Voix moteur synthétisée, indépendante de la simulation : elle ne reçoit qu'un régime et une charge.
// Après la construction du graphe, tout paramètre continu passe par `setTargetAtTime`, pour ne pas faire de clics.
import { buildCycle, cycleSpectrum, type EnginePreset } from "./enginePresets";

export type EngineLayer =
  | "saturation"
  | "exhaust"
  | "intake"
  | "mechanical"
  | "overrun"
  | "pops"
  | "turbo";

export type EngineLayers = Record<EngineLayer, number>;

export const DEFAULT_LAYERS: EngineLayers = {
  saturation: 1,
  exhaust: 1,
  intake: 1,
  mechanical: 1,
  overrun: 1,
  pops: 1,
  turbo: 1,
};

/** Appelé à chaque détonation programmée : dans combien de secondes elle part, et sa force. */
export type PopListener = (delayS: number, strength: number) => void;

export interface EngineVoice {
  /** `rpm` et `throttle` (0 à 1) à chaque image ; le rythme des ordres audio est limité ici. */
  update: (rpm: number, throttle: number, dt: number) => void;
  setLayer: (layer: EngineLayer, value: number) => void;
  /** Ordres envoyés au fil audio depuis le début, pour le mode diagnostic */
  writes: () => number;
  dispose: () => void;
}

interface RevRange {
  idleRpm: number;
  redlineRpm: number;
}

const UPDATE_PERIOD = 1 / 30;
const CHANGE_RATIO = 0.005;
const CHANGE_FLOOR = 0.0005;
const FADE_TC = 0.02;
const SATURATION_CURVE_SIZE = 2048;
/** La courbe d'un `WaveShaper` ne couvre que -1 à 1 : le signal entre divisé par cette valeur, pour ne pas buter dessus. */
const SATURATION_RANGE = 8;
/** Une tension décalée rend la saturation asymétrique : elle ajoute des harmoniques paires, plus chaudes. */
const SATURATION_BIAS = 0.12;
const TURBINE_MIN_RPM = 2400;
const TURBINE_FULL_RPM = 5200;
const TURBINE_COAST_S = 1.4;
const TURBINE_SUSTAIN = 0.2;
const SURGE_TC = 0.25;
const WHISTLE_TONE = 0.3;
const WHOOSH_Q = 6;
const BLOW_OFF_MIN_BOOST = 0.35;
const BLOW_OFF_MIN_GAP_S = 0.4;
const LIFT_POP_COUNT = 3;
const LIFT_POP_WINDOW_S = 0.5;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const ramp = (low: number, high: number, value: number): number =>
  clamp01((value - low) / (high - low));

export interface TurbineState {
  /** Vitesse de la turbine, 0 à 1 */
  spin: number;
  /** Montée en régime en cours, 0 à 1 : c'est elle qu'on entend, pas la turbine stabilisée */
  surge: number;
}

/** Sur son élan, la turbine ralentit lentement : un passage de rapport ne la fait presque pas retomber. */
export const stepTurbine = (
  turbine: TurbineState,
  spoolS: number,
  load: number,
  rpm: number,
  dt: number,
): void => {
  const target = load * ramp(TURBINE_MIN_RPM, TURBINE_FULL_RPM, rpm);
  const timeConstant = target > turbine.spin ? spoolS : TURBINE_COAST_S;
  const gained = (target - turbine.spin) * (1 - Math.exp(-dt / timeConstant));
  turbine.spin += gained;
  const rising = clamp01((gained / dt) * spoolS);
  turbine.surge += (rising - turbine.surge) * (1 - Math.exp(-dt / SURGE_TC));
};

/** Pied au plancher et régime stable, il ne reste qu'un fond discret sous l'échappement. */
export const turbineLevel = ({ spin, surge }: TurbineState): number =>
  spin * (TURBINE_SUSTAIN + (1 - TURBINE_SUSTAIN) * surge);

const saturationCurve = (): Float32Array<ArrayBuffer> => {
  const curve = new Float32Array(SATURATION_CURVE_SIZE);
  const offset = Math.tanh(SATURATION_BIAS);
  for (let i = 0; i < SATURATION_CURVE_SIZE; i++) {
    const x = (i / (SATURATION_CURVE_SIZE - 1)) * 2 - 1;
    curve[i] = Math.tanh(SATURATION_RANGE * x + SATURATION_BIAS) - offset;
  }
  return curve;
};

/** Valeurs aléatoires reliées en ligne droite, jouées en boucle pour faire vivre un paramètre. */
export const randomSignal = (
  ctx: BaseAudioContext,
  seconds: number,
  stepHz: number,
): AudioBuffer => {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const samples = buffer.getChannelData(0);
  const stepSize = Math.max(1, Math.round(ctx.sampleRate / stepHz));
  const stepCount = Math.ceil(samples.length / stepSize);
  const points = Array.from({ length: stepCount }, () => Math.random() * 2 - 1);
  for (let i = 0; i < samples.length; i++) {
    const position = i / stepSize;
    const index = Math.floor(position);
    const next = points[(index + 1) % stepCount];
    samples[i] = points[index] + (next - points[index]) * (position - index);
  }
  return buffer;
};

export const createEngineVoice = (
  ctx: AudioContext,
  destination: AudioNode,
  preset: EnginePreset,
  range: RevRange,
  initialLayers: EngineLayers = DEFAULT_LAYERS,
  onPop?: PopListener,
): EngineVoice => {
  const layers: EngineLayers = { ...initialLayers };
  const nodes: AudioNode[] = [];
  const sources: AudioScheduledSourceNode[] = [];
  const track = <T extends AudioNode>(node: T): T => {
    nodes.push(node);
    return node;
  };
  const gainNode = (
    value: number,
    output?: AudioNode | AudioParam,
  ): GainNode => {
    const node = track(ctx.createGain());
    node.gain.value = value;
    // `connect` accepte les deux, mais ses surcharges ne se combinent pas.
    if (output) node.connect(output as AudioNode);
    return node;
  };
  const filterNode = (
    type: BiquadFilterType,
    frequency: number,
    q: number,
    output: AudioNode,
  ): BiquadFilterNode => {
    const node = track(ctx.createBiquadFilter());
    node.type = type;
    node.frequency.value = frequency;
    node.Q.value = q;
    node.connect(output);
    return node;
  };
  const loop = (buffer: AudioBuffer, output: AudioNode): void => {
    const source = track(ctx.createBufferSource());
    source.buffer = buffer;
    source.loop = true;
    source.connect(output);
    source.start();
    sources.push(source);
  };
  const oscillator = (
    type: OscillatorType,
    output: AudioNode,
  ): OscillatorNode => {
    const osc = track(ctx.createOscillator());
    osc.type = type;
    osc.connect(output);
    osc.start();
    sources.push(osc);
    return osc;
  };

  const output = gainNode(0, destination);
  output.gain.setTargetAtTime(1, ctx.currentTime, FADE_TC);

  // Échappement : le cycle passe par la saturation, puis par le corps du son et les résonances.
  const engineGain = gainNode(0, output);
  const bodyFilter = filterNode(
    "lowpass",
    preset.body.closedHz,
    0.7,
    engineGain,
  );
  const resonanceBus = gainNode(layers.exhaust, engineGain);
  const dcBlock = filterNode("highpass", 28, 0.7, bodyFilter);
  for (const { hz, q, gain } of preset.resonances)
    dcBlock.connect(
      filterNode("bandpass", hz, q, gainNode(gain, resonanceBus)),
    );

  const trim = gainNode(1, dcBlock);
  const shaper = track(ctx.createWaveShaper());
  shaper.curve = saturationCurve();
  shaper.oversample = "2x";
  shaper.connect(trim);
  const drive = gainNode(1 / SATURATION_RANGE, shaper);

  const cycleBus = gainNode(1, drive);
  const flutterAmount = gainNode(0.05, cycleBus.gain);
  const waveFor = (spread: number): PeriodicWave => {
    const { real, imag } = cycleSpectrum(buildCycle(preset, spread));
    return ctx.createPeriodicWave(real, imag);
  };
  const cycleOscs = [
    { spread: 1, level: 0.6, detune: 0 },
    { spread: 1.7, level: 0.4, detune: 5 },
  ].map(({ spread, level, detune }) => {
    const osc = oscillator("sine", gainNode(level, cycleBus));
    osc.setPeriodicWave(waveFor(spread));
    osc.detune.value = detune;
    return osc;
  });

  // Instabilité : le régime et la force des explosions ne sont jamais tout à fait constants.
  const flutter = randomSignal(ctx, 3, 9);
  const wobble = gainNode(preset.wobbleCents);
  for (const osc of cycleOscs) wobble.connect(osc.detune);
  const flutterBus = gainNode(1);
  flutterBus.connect(wobble);
  flutterBus.connect(flutterAmount);
  loop(flutter, flutterBus);

  // Frein moteur : le même cycle, sombre et haché par des allumages manqués.
  const overrunGain = gainNode(0, output);
  const overrunGate = gainNode(0.55, overrunGain);
  loop(randomSignal(ctx, 3, 70), gainNode(0.45, overrunGate.gain));
  const overrunFilter = filterNode(
    "lowpass",
    preset.overrun.hz,
    1.3,
    overrunGate,
  );
  cycleBus.connect(overrunFilter);

  // Bruit partagé. L'admission et la mécanique respirent au rythme des explosions.
  const noise = randomSignal(ctx, 2, ctx.sampleRate);
  const firing = gainNode(1);
  const firingOsc = oscillator("sawtooth", firing);

  const intakeGain = gainNode(0, output);
  const intakeVca = gainNode(0.6, intakeGain);
  firing.connect(gainNode(0.4, intakeVca.gain));
  const intakeFilter = filterNode(
    "bandpass",
    preset.intake.hz,
    preset.intake.q,
    intakeVca,
  );
  loop(noise, intakeFilter);

  const mechanicalGain = gainNode(0, output);
  const mechanicalVca = gainNode(0.5, mechanicalGain);
  firing.connect(gainNode(0.5, mechanicalVca.gain));
  loop(noise, filterNode("highpass", preset.mechanical.hz, 0.7, mechanicalVca));

  // Sifflement de la boîte à taille droite.
  const whineGain = gainNode(0, output);
  const whineOsc = oscillator("triangle", whineGain);

  // Turbo : un souffle étroit, avec un peu de sifflement. Une sinusoïde seule sonne comme un synthé.
  const turbo = preset.turbo;
  const whistleGain = gainNode(0, output);
  const whistleOsc = turbo
    ? oscillator("sine", gainNode(WHISTLE_TONE, whistleGain))
    : null;
  if (whistleOsc) wobble.connect(whistleOsc.detune);
  const whooshFilter = turbo
    ? filterNode("bandpass", turbo.minHz, WHOOSH_Q, whistleGain)
    : null;
  if (whooshFilter) loop(noise, whooshFilter);

  let disposed = false;
  let elapsed = UPDATE_PERIOD;
  const turbine: TurbineState = { spin: 0, surge: 0 };
  let lastThrottle = 0;
  let lastBlowOffAt = Number.NEGATIVE_INFINITY;
  let writes = 0;
  const targets = new Map<AudioParam, number>();

  const setParam = (
    param: AudioParam,
    value: number,
    timeConstant: number,
  ): void => {
    const previous = targets.get(param);
    if (
      previous !== undefined &&
      Math.abs(value - previous) <=
        Math.max(CHANGE_FLOOR, Math.abs(previous) * CHANGE_RATIO)
    )
      return;
    targets.set(param, value);
    writes++;
    param.setTargetAtTime(value, ctx.currentTime, timeConstant);
  };

  const noiseShot = (
    at: number,
    duration: number,
    target: AudioNode,
  ): AudioBufferSourceNode => {
    const source = ctx.createBufferSource();
    source.buffer = noise;
    source.connect(target);
    source.start(
      at,
      Math.random() * (noise.duration - duration - 0.01),
      duration,
    );
    source.onended = () => source.disconnect();
    return source;
  };

  const pop = (at: number, strength: number): void => {
    const peak = preset.pops.level * layers.pops * strength;
    if (peak <= 0) return;
    onPop?.(at - ctx.currentTime, strength);
    const decay = 0.012 + Math.random() * 0.03;
    const end = at + decay * 7;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(peak, at, 0.0015);
    gain.gain.setTargetAtTime(0, at + 0.006, decay);
    gain.connect(output);
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = preset.pops.hz * (0.7 + Math.random() * 0.7);
    filter.Q.value = 0.9;
    filter.connect(gain);
    noiseShot(at, end - at, filter);
    const thump = ctx.createOscillator();
    thump.frequency.setValueAtTime(170, at);
    thump.frequency.exponentialRampToValueAtTime(55, end);
    thump.connect(gain);
    thump.start(at);
    thump.stop(end);
    thump.onended = () => {
      thump.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  };

  const blowOff = (at: number, strength: number): void => {
    if (!turbo) return;
    const peak = turbo.blowOff * layers.turbo * strength;
    if (peak <= 0) return;
    const duration = 0.42;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(peak, at, 0.006);
    gain.gain.setTargetAtTime(0, at + 0.07, 0.09);
    gain.connect(output);
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 1.1;
    filter.frequency.setValueAtTime(3600, at);
    filter.frequency.exponentialRampToValueAtTime(1100, at + duration);
    filter.connect(gain);
    const source = noiseShot(at, duration, filter);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  };

  const update = (rpm: number, throttle: number, dt: number): void => {
    if (disposed) return;
    const load = clamp01(throttle);
    const now = ctx.currentTime;

    // Levée de pied : détectée à chaque image, le coup de gaz peut durer moins qu'une période d'ordres.
    const lifted = lastThrottle > 0.4 && load < 0.1;
    lastThrottle = load;
    if (lifted && rpm >= preset.pops.minRpm)
      for (let i = 0; i < LIFT_POP_COUNT; i++)
        if (Math.random() < 0.7)
          pop(
            now + 0.02 + Math.random() * LIFT_POP_WINDOW_S,
            0.7 + Math.random() * 0.5,
          );
    if (
      turbo &&
      lifted &&
      turbine.spin > BLOW_OFF_MIN_BOOST &&
      now - lastBlowOffAt > BLOW_OFF_MIN_GAP_S
    ) {
      lastBlowOffAt = now;
      blowOff(now + 0.01, turbine.spin);
    }

    elapsed += dt;
    if (elapsed < UPDATE_PERIOD) return;
    const stepS = elapsed;
    elapsed = 0;

    const rev = ramp(range.idleRpm, range.redlineRpm, rpm);
    const overrun =
      ramp(range.idleRpm * 1.15, range.idleRpm * 1.9, rpm) *
      (1 - ramp(0.02, 0.15, load));
    const cycleHz = Math.max(rpm, range.idleRpm * 0.6) / 120;

    for (const osc of cycleOscs) setParam(osc.frequency, cycleHz, 0.02);
    setParam(firingOsc.frequency, cycleHz * preset.pulses.length, 0.02);
    setParam(
      whineOsc.frequency,
      (rpm / 60) * preset.mechanical.whineOrder,
      0.03,
    );

    // Saturation : le gain d'entrée monte avec la charge, la sortie compense pour garder le même volume.
    const driven = 1 + layers.saturation * preset.drive * (0.25 + 0.75 * load);
    setParam(drive.gain, driven / SATURATION_RANGE, 0.04);
    setParam(trim.gain, 1 / Math.sqrt(driven), 0.04);

    setParam(
      bodyFilter.frequency,
      preset.body.closedHz +
        rev * preset.body.revHz +
        load * preset.body.loadHz,
      0.07,
    );
    setParam(
      engineGain.gain,
      (0.26 + rev * 0.16 + load * 0.3) * (1 - 0.75 * overrun),
      0.05,
    );
    setParam(
      overrunGain.gain,
      overrun * preset.overrun.level * layers.overrun * (0.55 + 0.45 * rev),
      0.06,
    );
    setParam(resonanceBus.gain, layers.exhaust, 0.05);

    setParam(
      intakeFilter.frequency,
      preset.intake.hz * (0.75 + 0.6 * rev),
      0.05,
    );
    setParam(
      intakeGain.gain,
      preset.intake.level * layers.intake * (0.08 + load * (0.35 + 0.65 * rev)),
      0.05,
    );
    setParam(
      mechanicalGain.gain,
      preset.mechanical.level * layers.mechanical * (0.25 + 0.75 * rev),
      0.08,
    );
    setParam(
      whineGain.gain,
      preset.mechanical.whine * layers.mechanical * rev * (0.5 + 0.5 * load),
      0.06,
    );

    // Coups isolés au frein moteur, en plus de ceux de la levée de pied.
    if (
      overrun > 0.5 &&
      rpm >= preset.pops.minRpm &&
      Math.random() < preset.pops.perSecond * stepS
    )
      pop(now + Math.random() * stepS, 0.4 + Math.random() * 0.6);

    if (turbo && whistleOsc && whooshFilter) {
      stepTurbine(turbine, turbo.spoolS, load, rpm, stepS);
      const pitch = turbo.minHz + (turbo.maxHz - turbo.minHz) * turbine.spin;
      setParam(whistleOsc.frequency, pitch, 0.12);
      setParam(whooshFilter.frequency, pitch, 0.12);
      setParam(
        whistleGain.gain,
        turbineLevel(turbine) * turbo.whistle * layers.turbo,
        0.08,
      );
    }
  };

  return {
    update,
    writes: () => writes,
    setLayer: (layer, value) => {
      layers[layer] = value;
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      output.gain.cancelScheduledValues(ctx.currentTime);
      output.gain.setTargetAtTime(0, ctx.currentTime, FADE_TC);
      const stopAt = ctx.currentTime + FADE_TC * 6;
      for (const source of sources) source.stop(stopAt);
      // Les nœuds se débranchent une fois le fondu joué, sur le dernier oscillateur arrêté.
      sources[sources.length - 1].onended = () => {
        for (const node of nodes) node.disconnect();
      };
    },
  };
};
