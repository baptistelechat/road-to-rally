// Exemple de phrase des options. Son propre contexte : celui du jeu est suspendu en pause, et le relancer ferait repartir le moteur.
// Seuls les morceaux de l'exemple sont chargés, pour les deux voix dès la création : charger toute la voix retardait la phrase de plusieurs secondes.
import { COPILOT_VOICES, type CopilotVoiceId } from "./copilotVoice";
import { resolveContext } from "./engineAudio";
import { clipFile } from "./paceNoteWords";

const EXAMPLE: readonly string[] = ["gauche trois", "puis droite cinq"];
/** Mêmes réglages que la voix du jeu */
const VOICE_GAIN = 2;
const CLIP_GAP_S = 0.03;
const START_LEAD_S = 0.02;
const FADE_TC_S = 0.005;
const DECODE_SAMPLE_RATE = 22050;

export interface VoicePreview {
  /** Fichier manquant ou son bloqué par le navigateur : silence, sans erreur. */
  say: (voice: CopilotVoiceId, volume: number) => void;
  stop: () => void;
  dispose: () => void;
}

const fetchClip = async (
  voice: CopilotVoiceId,
  clip: string,
): Promise<AudioBuffer | null> => {
  try {
    const response = await fetch(
      `/audio/copilot/${voice}/${clipFile(clip)}.wav`,
    );
    if (!response.ok) return null;
    // Hors ligne : le décodage n'attend ni geste du joueur ni contexte.
    const decoder = new OfflineAudioContext(1, 1, DECODE_SAMPLE_RATE);
    return await decoder.decodeAudioData(await response.arrayBuffer());
  } catch {
    return null;
  }
};

export const createVoicePreview = (): VoicePreview => {
  const clips = new Map(
    COPILOT_VOICES.map((voice) => [
      voice,
      Promise.all(EXAMPLE.map((clip) => fetchClip(voice, clip))),
    ]),
  );
  let context: AudioContext | null = null;
  let output: AudioNode | null = null;
  let gain: GainNode | null = null;
  // Un choix plus récent annule une phrase dont les fichiers arrivent encore.
  let request = 0;

  const stop = (): void => {
    request++;
    if (!gain || !context) return;
    gain.gain.setTargetAtTime(0, context.currentTime, FADE_TC_S);
    const old = gain;
    gain = null;
    setTimeout(() => old.disconnect(), 100);
  };

  return {
    say: (voice, volume) => {
      stop();
      const current = request;
      context ??= resolveContext();
      if (!context) return;
      const ctx = context;
      // Un contexte neuf naît suspendu : le relancer pendant le geste du joueur.
      Promise.all([clips.get(voice), ctx.resume()])
        .then(([buffers]) => {
          if (current !== request || ctx.state !== "running" || !buffers)
            return;
          if (!output) {
            // Même compresseur en sortie que le jeu : il tient les pics du gain de la voix.
            output = ctx.createDynamicsCompressor();
            output.connect(ctx.destination);
          }
          gain = ctx.createGain();
          gain.gain.value = volume * VOICE_GAIN;
          gain.connect(output);
          let at = ctx.currentTime + START_LEAD_S;
          for (const buffer of buffers) {
            if (!buffer) continue;
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(gain);
            source.start(at);
            at += buffer.duration + CLIP_GAP_S;
          }
        })
        .catch(() => undefined);
    },
    stop,
    dispose: () => {
      stop();
      context?.close().catch(() => undefined);
      context = null;
      output = null;
    },
  };
};
