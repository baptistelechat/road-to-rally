// Exemple de phrase des options. Son propre contexte : celui du jeu est suspendu en pause, et le relancer ferait repartir le moteur.
import { createCopilotVoice, type CopilotVoiceId } from "./copilotVoice";
import { resolveContext } from "./engineAudio";

const EXAMPLE: readonly string[] = ["gauche trois", "puis droite cinq"];

export interface VoicePreview {
  /** Fichier manquant ou son bloqué par le navigateur : silence, sans erreur. */
  say: (voice: CopilotVoiceId, volume: number) => void;
  stop: () => void;
  dispose: () => void;
}

export const createVoicePreview = (): VoicePreview => {
  let context: AudioContext | null = null;
  let output: AudioNode | null = null;
  // Même compresseur en sortie que le jeu : il tient les pics du gain de la voix.
  const voice = createCopilotVoice(() => {
    if (!context) return null;
    if (!output) {
      output = context.createDynamicsCompressor();
      output.connect(context.destination);
    }
    return { context, output };
  });
  return {
    say: (id, volume) => {
      voice.setVoice(id);
      voice.setVolume(volume);
      context ??= resolveContext();
      // Un contexte neuf naît suspendu : `playClips` n'accepte qu'un contexte qui tourne.
      Promise.all([voice.load(), context?.resume()])
        .then(() => voice.playClips(EXAMPLE))
        .catch(() => undefined);
    },
    stop: voice.stop,
    dispose: () => {
      voice.stop();
      context?.close().catch(() => undefined);
      context = null;
      output = null;
    },
  };
};
