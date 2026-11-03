// Exemple de phrase des options. Son propre contexte : celui du jeu est suspendu en pause, et le relancer ferait repartir le moteur.
import { createCopilotVoice } from "./copilotVoice";
import { resolveContext } from "./engineAudio";
import type { PaceWord } from "./paceNoteWords";

const EXAMPLE: readonly PaceWord[] = [
  "gauche",
  "trois",
  "puis",
  "droite",
  "cinq",
];

export interface VoicePreview {
  /** Fichier manquant ou son bloqué par le navigateur : silence, sans erreur. */
  say: (rate: number, volume: number) => void;
  stop: () => void;
  dispose: () => void;
}

export const createVoicePreview = (): VoicePreview => {
  let context: AudioContext | null = null;
  const voice = createCopilotVoice(() =>
    context ? { context, output: context.destination } : null,
  );
  const loaded = voice.load();
  return {
    say: (rate, volume) => {
      voice.setRate(rate);
      voice.setVolume(volume);
      context ??= resolveContext();
      // Un contexte neuf naît suspendu : `playWords` n'accepte qu'un contexte qui tourne.
      Promise.all([loaded, context?.resume()])
        .then(() => voice.playWords(EXAMPLE))
        .catch(() => undefined);
    },
    stop: voice.stop,
    dispose: () => {
      voice.stop();
      context?.close().catch(() => undefined);
      context = null;
    },
  };
};
