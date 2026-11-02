// Son de la voiture, entièrement synthétisé avec Web Audio. Lit `CarState` sans jamais l'écrire.
// Après la construction du graphe, tout paramètre passe par `setTargetAtTime`, pour ne pas faire de clics.
import { carConfig } from "@/sim/carConfig";
import type { CarState } from "@/sim/types";
import {
  DEFAULT_ENGINE,
  enginePreset,
  type EnginePresetId,
} from "./enginePresets";
import { createTireVoice, type ParamWriter, type TireVoice } from "./tireVoice";
import {
  createEngineVoice,
  DEFAULT_LAYERS,
  type EngineVoice,
  type PopListener,
} from "./engineVoice";

export interface CarAudio {
  /** Tente de lancer le son : sans geste du joueur, le navigateur peut le bloquer */
  start: () => void;
  /** À appeler depuis un geste de fin d'action (`click`, `pointerup`, `keydown`) : relance le son et lève le blocage */
  unlock: () => void;
  /** Le jeu attend un geste du joueur pour jouer le premier son */
  isBlocked: () => boolean;
  /** Menu pause : coupe tout le son, sans toucher au réglage du joueur. Appelable à chaque image. */
  setPaused: (paused: boolean) => void;
  update: (state: CarState, dt: number) => void;
  /** Prévient à chaque détonation d'échappement, même son coupé : les flammes partent en même temps. */
  setPopListener: (listener: PopListener | null) => void;
  setMuted: (muted: boolean) => void;
  /** Renvoie le nouvel état */
  toggleMute: () => boolean;
  isMuted: () => boolean;
  /** Volume général, 0 à 1 */
  setVolume: (volume: number) => void;
  dispose: () => void;
  /** État du contexte audio, pour le mode diagnostic */
  debug: () => AudioDebug | null;
}

export interface AudioDebug {
  state: string;
  time: number;
  baseLatency: number;
  outputLatency: number;
  /** Ordres envoyés au fil audio depuis le début */
  writes: number;
  /** Trous dans le son signalés par le navigateur, si elle les expose */
  underruns: number;
}

const MUTE_TC = 0.03;
/** Chaque ordre passe par le fil audio : à 60 Hz sur 9 paramètres, il en recevait 540 par seconde. */
const UPDATE_PERIOD = 1 / 30;
/** En dessous de cet écart relatif, l'oreille ne fait pas la différence : pas d'ordre. */
const CHANGE_RATIO = 0.005;
const CHANGE_FLOOR = 0.0005;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const ramp = (low: number, high: number, value: number): number =>
  clamp01((value - low) / (high - low));

export const resolveContext = (): AudioContext | null => {
  if (typeof window === "undefined") return null;
  const legacy = window as Window & {
    webkitAudioContext?: typeof AudioContext;
  };
  const Ctor = window.AudioContext ?? legacy.webkitAudioContext;
  if (!Ctor) return null;
  try {
    // « balanced » et non le réglage par défaut, le plus court : 25 à 50 ms de retard ne s'entendent pas sur un moteur,
    // et le son tient mieux quand la machine cale (voir diag/ : 625 trous en 91 s).
    return new Ctor({ latencyHint: "balanced" });
  } catch {
    return null;
  }
};

interface NoiseVoice {
  source: AudioBufferSourceNode;
  filter: BiquadFilterNode;
  gain: GainNode;
}

interface Graph {
  master: GainNode;
  compressor: DynamicsCompressorNode;
  engine: EngineVoice;
  shiftGain: GainNode;
  tires: TireVoice;
  grass: NoiseVoice;
  wind: NoiseVoice;
  thumpNoise: NoiseVoice;
  thumpOsc: OscillatorNode;
  thumpGain: GainNode;
  nodes: AudioNode[];
}

const buildGraph = (
  ctx: AudioContext,
  destination: AudioNode,
  engineId: EnginePresetId,
  onPop: PopListener,
  write: ParamWriter,
): Graph => {
  const nodes: AudioNode[] = [];
  const track = <T extends AudioNode>(node: T): T => {
    nodes.push(node);
    return node;
  };
  const gainNode = (value: number, output: AudioNode): GainNode => {
    const node = track(ctx.createGain());
    node.gain.value = value;
    node.connect(output);
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

  const compressor = track(ctx.createDynamicsCompressor());
  compressor.connect(destination);
  const master = gainNode(0, compressor);

  const shiftGain = gainNode(1, master);
  const engine = createEngineVoice(
    ctx,
    shiftGain,
    enginePreset(engineId),
    carConfig.engine,
    DEFAULT_LAYERS,
    onPop,
  );

  // Un seul tampon de bruit blanc en boucle alimente toutes les voix de bruit.
  const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const samples = noise.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  const noiseVoice = (
    type: BiquadFilterType,
    frequency: number,
    q: number,
  ): NoiseVoice => {
    const gain = gainNode(0, master);
    const filter = filterNode(type, frequency, q, gain);
    const source = track(ctx.createBufferSource());
    source.buffer = noise;
    source.loop = true;
    source.connect(filter);
    return { source, filter, gain };
  };

  const tires = createTireVoice(ctx, master, write);
  const grass = noiseVoice("lowpass", 320, 0.7);
  const wind = noiseVoice("bandpass", 400, 0.6);
  const thumpNoise = noiseVoice("lowpass", 180, 0.7);

  const thumpGain = gainNode(0, master);
  const thumpOsc = track(ctx.createOscillator());
  thumpOsc.type = "sine";
  thumpOsc.frequency.value = 45;
  thumpOsc.connect(thumpGain);

  thumpOsc.start();
  for (const voice of [grass, wind, thumpNoise]) voice.source.start();

  return {
    master,
    compressor,
    engine,
    shiftGain,
    tires,
    grass,
    wind,
    thumpNoise,
    thumpOsc,
    thumpGain,
    nodes,
  };
};

const ANALYSIS = {
  maxAsphaltSlip: 0,
  grassShare: 0,
  contacts: 0,
  compression: 0,
};

const analyzeWheels = (state: CarState): void => {
  let maxAsphaltSlip = 0;
  let grass = 0;
  let contacts = 0;
  let compression = 0;
  for (const wheel of state.wheels) {
    compression += wheel.compression;
    if (!wheel.inContact) continue;
    contacts++;
    if (wheel.surface === "grass") grass++;
    else maxAsphaltSlip = Math.max(maxAsphaltSlip, wheel.slip);
  }
  ANALYSIS.maxAsphaltSlip = maxAsphaltSlip;
  ANALYSIS.grassShare = state.wheels.length ? grass / state.wheels.length : 0;
  ANALYSIS.contacts = contacts;
  ANALYSIS.compression = state.wheels.length
    ? compression / state.wheels.length
    : 0;
};

/** @param injected contexte fourni de l'extérieur, utilisé par la vérification sans navigateur */
export const createCarAudio = (
  injected?: AudioContext,
  engineId: EnginePresetId = DEFAULT_ENGINE,
): CarAudio => {
  const { shiftTimeS } = carConfig.engine;
  let ctx: AudioContext | null = null;
  let graph: Graph | null = null;
  let muted = false;
  let volume = 0.8;
  let disposed = false;
  let unlocked = false;
  let paused = false;
  let elapsed = UPDATE_PERIOD;
  let lastGear: number | null = null;
  let lastImpact = 0;
  let lastCompression = 0;
  let airTime = 0;
  let lastShiftAt = Number.NEGATIVE_INFINITY;
  let lastThumpAt = Number.NEGATIVE_INFINITY;
  let writes = 0;
  let popListener: PopListener | null = null;
  const targets = new Map<AudioParam, number>();

  const setParam = (
    param: AudioParam,
    value: number,
    now: number,
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
    param.setTargetAtTime(value, now, timeConstant);
  };

  const applyMaster = (): void => {
    if (!ctx || !graph) return;
    graph.master.gain.setTargetAtTime(
      muted ? 0 : volume,
      ctx.currentTime,
      MUTE_TC,
    );
  };

  const onVisibility = (): void => {
    if (!ctx) return;
    // Onglet caché : la boucle de rendu s'arrête, le moteur resterait bloqué sur sa dernière note.
    const pending = document.hidden || paused ? ctx.suspend() : ctx.resume();
    pending.catch(() => undefined);
  };

  const thump = (strength: number, now: number): void => {
    if (!graph || now - lastThumpAt < 0.12) return;
    lastThumpAt = now;
    const peak = 0.25 + 0.75 * clamp01(strength);
    const { thumpGain, thumpOsc, thumpNoise } = graph;
    thumpOsc.frequency.cancelScheduledValues(now);
    thumpOsc.frequency.setTargetAtTime(100, now, 0.002);
    thumpOsc.frequency.setTargetAtTime(38, now + 0.012, 0.07);
    for (const [param, level] of [
      [thumpGain.gain, peak],
      [thumpNoise.gain.gain, peak * 0.5],
    ] as const) {
      param.cancelScheduledValues(now);
      param.setTargetAtTime(level, now, 0.004);
      param.setTargetAtTime(0, now + 0.03, 0.13);
    }
  };

  const start = (): void => {
    if (disposed) return;
    if (!ctx) ctx = injected ?? resolveContext();
    if (!ctx) return;
    if (!graph) {
      const audio = ctx;
      graph = buildGraph(
        ctx,
        ctx.destination,
        engineId,
        (delayS, strength) => popListener?.(delayS, strength),
        (param, value, timeConstant) =>
          setParam(param, value, audio.currentTime, timeConstant),
      );
      applyMaster();
      if (typeof document !== "undefined")
        document.addEventListener("visibilitychange", onVisibility);
    }
    if (ctx.state === "suspended" && !paused)
      ctx.resume().catch(() => undefined);
  };

  const update = (state: CarState, dt: number): void => {
    if (!ctx || !graph) return;
    // Contexte suspendu : son horloge est figée, les chocs planifiés partiraient tous à la reprise.
    if (ctx.state !== "running") return;
    unlocked = true;
    elapsed += dt;
    if (elapsed < UPDATE_PERIOD) return;
    const stepS = elapsed;
    elapsed = 0;

    const now = ctx.currentTime;
    analyzeWheels(state);
    const { maxAsphaltSlip, grassShare, contacts, compression } = ANALYSIS;
    const { speed, throttle, rpm, gear, impact } = state;

    // Coupure au passage de rapport. Le délai minimal évite de couper deux fois si le rapport passe par le point mort.
    if (
      lastGear !== null &&
      gear !== lastGear &&
      now - lastShiftAt > shiftTimeS * 1.5
    ) {
      lastShiftAt = now;
      const param = graph.shiftGain.gain;
      param.cancelScheduledValues(now);
      param.setTargetAtTime(0.12, now, 0.012);
      param.setTargetAtTime(1, now + shiftTimeS, 0.035);
    }
    lastGear = gear;

    // Moteur. La charge retombe pendant le passage : il s'entend comme un pied levé, pétarades comprises.
    graph.engine.update(
      rpm,
      now - lastShiftAt < shiftTimeS ? 0 : throttle,
      stepS,
    );

    graph.tires.update(maxAsphaltSlip, speed);

    // Roulement sur l'herbe
    setParam(
      graph.grass.gain.gain,
      grassShare * ramp(1, 25, speed) * 0.5,
      now,
      0.06,
    );

    // Souffle du vent, en puissance de la vitesse
    const windAmount = ramp(5, 70, speed);
    setParam(graph.wind.gain.gain, windAmount * windAmount * 0.3, now, 0.1);
    setParam(graph.wind.filter.frequency, 300 + speed * 14, now, 0.1);

    // Chocs : front montant de `impact`, puis réception après un saut ou un écrasement brutal de la suspension.
    if (impact > lastImpact + 0.02) thump(impact, now);
    lastImpact = impact;
    if (contacts === 0) airTime += stepS;
    else {
      if (airTime > 0.15) thump(airTime * 1.2, now);
      airTime = 0;
    }
    if ((compression - lastCompression) / stepS > 8) thump(0.4, now);
    lastCompression = compression;
  };

  const setMuted = (next: boolean): void => {
    muted = next;
    applyMaster();
  };

  return {
    start,
    // Lève le blocage même si le navigateur refuse encore (touche Échap) : au pire, la course reste silencieuse.
    unlock: () => {
      start();
      unlocked = true;
    },
    isBlocked: () => ctx !== null && !unlocked,
    setPaused: (next) => {
      if (next === paused) return;
      paused = next;
      if (!ctx) return;
      (paused ? ctx.suspend() : ctx.resume()).catch(() => undefined);
    },
    update,
    setPopListener: (listener) => {
      popListener = listener;
    },
    setMuted,
    toggleMute: () => {
      setMuted(!muted);
      return muted;
    },
    isMuted: () => muted,
    debug: () => {
      if (!ctx) return null;
      // Propriété récente de Chrome, absente des types : on s'en passe si elle n'existe pas.
      const stats = (
        ctx as unknown as { playbackStats?: { underrunEvents?: number } }
      ).playbackStats;
      return {
        state: ctx.state,
        time: ctx.currentTime,
        baseLatency: ctx.baseLatency ?? 0,
        outputLatency: ctx.outputLatency ?? 0,
        writes: writes + (graph?.engine.writes() ?? 0),
        underruns: stats?.underrunEvents ?? 0,
      };
    },
    setVolume: (next) => {
      volume = clamp01(next);
      applyMaster();
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      if (typeof document !== "undefined")
        document.removeEventListener("visibilitychange", onVisibility);
      if (graph) {
        graph.engine.dispose();
        graph.thumpOsc.stop();
        graph.tires.dispose();
        for (const voice of [
          graph.grass,
          graph.wind,
          graph.thumpNoise,
        ])
          voice.source.stop();
        for (const node of graph.nodes) node.disconnect();
      }
      // Un contexte injecté appartient à l'appelant.
      if (ctx && ctx !== injected) ctx.close().catch(() => undefined);
      ctx = null;
      graph = null;
    },
  };
};
