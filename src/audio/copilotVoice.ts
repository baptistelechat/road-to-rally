// Voix du copilote : mots enregistrés, enchaînés sur l'horloge audio. Sait prononcer une annonce, pas décider quand.
import type { PaceCall } from "@/sim/track/paceNotes";
import {
  callToWords,
  PACE_WORDS,
  type CallWordsOptions,
  type PaceWord,
} from "./paceNoteWords";

/** Où brancher la voix. `null` tant que le contexte n'existe pas : il naît au premier `start()` de `CarAudio`. */
export interface VoiceBus {
  context: AudioContext;
  output: AudioNode;
}

/** `playbackRate` change aussi la hauteur : la plage reste étroite. */
export const SPEECH_RATES = { lent: 0.85, normal: 1, rapide: 1.2 } as const;

export interface CopilotVoice {
  /** Charge et décode tous les mots. Sans geste du joueur ni contexte : à lancer avant la course. Ne rejette jamais. */
  load: () => Promise<void>;
  /** Remplace la phrase en cours. Contexte absent ou suspendu : rien n'est programmé, et `isSpeaking` reste faux. */
  play: (call: PaceCall, options?: CallWordsOptions) => void;
  playWords: (words: readonly PaceWord[]) => void;
  stop: () => void;
  /** Durée de la phrase à la vitesse réglée, en secondes. Toujours finie, même sans fichier. */
  durationOf: (call: PaceCall, options?: CallWordsOptions) => number;
  /** Vitesse des prochaines phrases, ramenée dans la plage de `SPEECH_RATES` */
  setRate: (rate: number) => void;
  /** 0 à 1 */
  setVolume: (volume: number) => void;
  /** Vrai aussi pendant une pause : l'horloge est figée, la phrase reste en suspens */
  isSpeaking: () => boolean;
}

/** Le silence des fichiers est coupé : cet écart sépare les mots, en secondes à vitesse normale. */
const WORD_GAP_S = 0.03;
/** Durée d'un mot dont le fichier manque, en secondes */
const FALLBACK_WORD_S = 0.45;
/** Marge pour que le premier mot ne parte pas dans le passé, en secondes */
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
  const buffers = new Map<PaceWord, AudioBuffer>();
  let rate: number = SPEECH_RATES.normal;
  let volume = 1;
  let phrase: Phrase | null = null;

  const wordSeconds = (word: PaceWord): number =>
    buffers.get(word)?.duration ?? FALLBACK_WORD_S;

  const wordsSeconds = (words: readonly PaceWord[]): number =>
    (words.reduce((total, word) => total + wordSeconds(word), 0) +
      WORD_GAP_S * Math.max(0, words.length - 1)) /
    rate;

  const load = async (): Promise<void> => {
    await Promise.all(
      PACE_WORDS.map(async (word) => {
        try {
          const response = await fetch(`/audio/copilot/${word}.wav`);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          // Un contexte hors ligne : le décodage n'attend ni le geste du joueur ni le contexte du jeu.
          const decoder = new OfflineAudioContext(1, 1, DECODE_SAMPLE_RATE);
          const buffer = await decoder.decodeAudioData(
            await response.arrayBuffer(),
          );
          buffers.set(word, buffer);
        } catch (error) {
          console.error(`Voix du copilote : mot « ${word} » absent`, error);
        }
      }),
    );
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

  const playWords = (words: readonly PaceWord[]): void => {
    stop();
    const bus = getBus();
    if (!bus || bus.context.state !== "running") return;
    if (!words.some((word) => buffers.has(word))) return;
    const { context, output } = bus;
    const gain = context.createGain();
    gain.gain.value = volume;
    gain.connect(output);
    const start = context.currentTime + START_LEAD_S;
    const sources: AudioBufferSourceNode[] = [];
    let at = start;
    for (const word of words) {
      const buffer = buffers.get(word);
      if (buffer) {
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = rate;
        source.connect(gain);
        source.start(at);
        sources.push(source);
      }
      at += (wordSeconds(word) + WORD_GAP_S) / rate;
    }
    sources[sources.length - 1].onended = () => gain.disconnect();
    phrase = {
      context,
      gain,
      sources,
      endsAt: start + wordsSeconds(words),
    };
  };

  return {
    load,
    play: (call, options) => playWords(callToWords(call, options)),
    playWords,
    stop,
    durationOf: (call, options) => wordsSeconds(callToWords(call, options)),
    setRate: (next) => {
      rate = clamp(next, SPEECH_RATES.lent, SPEECH_RATES.rapide);
    },
    setVolume: (next) => {
      volume = clamp(next, 0, 1);
      if (phrase)
        phrase.gain.gain.setTargetAtTime(
          volume,
          phrase.context.currentTime,
          FADE_TC_S,
        );
    },
    isSpeaking: () =>
      phrase !== null && phrase.context.currentTime < phrase.endsAt,
  };
};
