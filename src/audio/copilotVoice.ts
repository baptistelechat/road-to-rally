// Voix du copilote : notes enregistrées entières, enchaînées sur l'horloge audio. Sait prononcer une annonce, pas décider quand.
import type { PaceCall } from "@/sim/track/paceNotes";
import {
  callToClips,
  clipFile,
  PACE_CLIPS,
  type CallWordsOptions,
} from "./paceNoteWords";

/** Où brancher la voix. `null` tant que le contexte n'existe pas : il naît au premier `start()` de `CarAudio`. */
export interface VoiceBus {
  context: AudioContext;
  output: AudioNode;
}

/** Dossiers de `public/audio/copilot/` : `ff_siwis` seule, et son mélange 50/50 avec `im_nicola` pour une voix d'homme. */
export const COPILOT_VOICES = ["siwis", "siwis-nicola"] as const;
export type CopilotVoiceId = (typeof COPILOT_VOICES)[number];

export interface CopilotVoice {
  /** Charge et décode les morceaux de la voix choisie. Sans geste du joueur ni contexte : à lancer avant la course. Ne rejette jamais. */
  load: () => Promise<void>;
  /** Remplace la phrase en cours. Contexte absent ou suspendu : rien n'est programmé, et `isSpeaking` reste faux. */
  play: (call: PaceCall, options?: CallWordsOptions) => void;
  playClips: (clips: readonly string[]) => void;
  stop: () => void;
  /** Durée de la phrase, en secondes. Toujours finie, même sans fichier. */
  durationOf: (call: PaceCall, options?: CallWordsOptions) => number;
  /** Seule la voix choisie est chargée. Déjà chargée une autre : la nouvelle la remplace une fois décodée. */
  setVoice: (voice: CopilotVoiceId) => void;
  /** 0 à 1 */
  setVolume: (volume: number) => void;
  /** Vrai aussi pendant une pause : l'horloge est figée, la phrase reste en suspens */
  isSpeaking: () => boolean;
}

/** Gain à 100 % du curseur : les fichiers sont normalisés pour ne pas saturer, et la voix passait sous le moteur. Le compresseur de sortie tient les pics. */
const VOICE_GAIN = 2;
/** Le silence des fichiers est coupé : cet écart sépare deux morceaux, en secondes. */
const CLIP_GAP_S = 0.03;
/** Durée d'un mot d'un morceau dont le fichier manque, en secondes */
const FALLBACK_WORD_S = 0.45;
/** Marge pour que le premier morceau ne parte pas dans le passé, en secondes */
const START_LEAD_S = 0.02;
const FADE_TC_S = 0.005;
const STOP_AFTER_S = 0.03;
const DECODE_SAMPLE_RATE = 22050;

const clamp = (value: number, low: number, high: number): number =>
  Math.min(high, Math.max(low, value));

interface Phrase {
  gain: GainNode;
  sources: AudioBufferSourceNode[];
  context: AudioContext;
  endsAt: number;
}

export const createCopilotVoice = (
  getBus: () => VoiceBus | null,
): CopilotVoice => {
  let buffers = new Map<string, AudioBuffer>();
  let voiceId: CopilotVoiceId = COPILOT_VOICES[0];
  let loading: { voice: CopilotVoiceId; done: Promise<void> } | null = null;
  let volume = 1;
  let phrase: Phrase | null = null;

  const clipSeconds = (clip: string): number =>
    buffers.get(clip)?.duration ?? FALLBACK_WORD_S * clip.split(" ").length;

  const clipsSeconds = (clips: readonly string[]): number =>
    clips.reduce((total, clip) => total + clipSeconds(clip), 0) +
    CLIP_GAP_S * Math.max(0, clips.length - 1);

  const load = (): Promise<void> => {
    if (loading?.voice === voiceId) return loading.done;
    const voice = voiceId;
    const next = new Map<string, AudioBuffer>();
    const done = Promise.all(
      PACE_CLIPS.map(async (clip) => {
        try {
          const response = await fetch(
            `/audio/copilot/${voice}/${clipFile(clip)}.wav`,
          );
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          // Un contexte hors ligne : le décodage n'attend ni le geste du joueur ni le contexte du jeu.
          const decoder = new OfflineAudioContext(1, 1, DECODE_SAMPLE_RATE);
          next.set(
            clip,
            await decoder.decodeAudioData(await response.arrayBuffer()),
          );
        } catch (error) {
          console.error(`Voix du copilote : « ${clip} » absent`, error);
        }
      }),
    ).then(() => {
      // Une voix rechoisie entre-temps garde la main.
      if (voiceId === voice) buffers = next;
    });
    loading = { voice, done };
    return done;
  };

  const stop = (): void => {
    if (!phrase) return;
    const { context, gain, sources } = phrase;
    phrase = null;
    const now = context.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setTargetAtTime(0, now, FADE_TC_S);
    for (const source of sources) source.stop(now + STOP_AFTER_S);
  };

  const playClips = (clips: readonly string[]): void => {
    stop();
    const bus = getBus();
    if (!bus || bus.context.state !== "running") return;
    if (!clips.some((clip) => buffers.has(clip))) return;
    const { context, output } = bus;
    const gain = context.createGain();
    gain.gain.value = volume * VOICE_GAIN;
    gain.connect(output);
    const start = context.currentTime + START_LEAD_S;
    const sources: AudioBufferSourceNode[] = [];
    let at = start;
    for (const clip of clips) {
      const buffer = buffers.get(clip);
      if (buffer) {
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(gain);
        source.start(at);
        sources.push(source);
      }
      at += clipSeconds(clip) + CLIP_GAP_S;
    }
    sources[sources.length - 1].onended = () => gain.disconnect();
    phrase = {
      context,
      gain,
      sources,
      endsAt: start + clipsSeconds(clips),
    };
  };

  return {
    load,
    play: (call, options) => playClips(callToClips(call, options)),
    playClips,
    stop,
    durationOf: (call, options) => clipsSeconds(callToClips(call, options)),
    setVoice: (next) => {
      if (next === voiceId) return;
      voiceId = next;
      stop();
      // Pas encore chargée : le premier `load()` prendra la bonne.
      if (loading) void load();
    },
    setVolume: (next) => {
      volume = clamp(next, 0, 1);
      if (phrase)
        phrase.gain.gain.setTargetAtTime(
          volume * VOICE_GAIN,
          phrase.context.currentTime,
          FADE_TC_S,
        );
    },
    isSpeaking: () =>
      phrase !== null && phrase.context.currentTime < phrase.endsAt,
  };
};
