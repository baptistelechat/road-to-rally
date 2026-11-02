// Assemble les notes, leur moment et la voix. Observateur strict : lit l'état après les pas de simulation sans jamais l'écrire.
import { createCopilotVoice, type CopilotVoice } from "@/audio/copilotVoice";
import type { CarAudio } from "@/audio/engineAudio";
import { callToWords, type PaceWord } from "@/audio/paceNoteWords";
import { createPaceNoteCue, type PaceCue } from "@/sim/paceNoteCue";
import type { LapTimer } from "@/sim/lapTimer";
import { computePaceNotes } from "@/sim/track/paceNotes";
import type { CarState, Track } from "@/sim/types";
import { setHudPaceCall, setHudPaceNotes, type GameScreen } from "./hudStore";

export interface CopilotSim {
  track: Track;
  lap: Pick<LapTimer, "finished">;
  state: () => CarState;
  respawnCount: () => number;
}

export type CopilotAudio = Pick<CarAudio, "voiceBus" | "isMuted">;

export interface Copilot {
  /** Chargement, vitesse de diction et volume : le reste passe par `update` */
  voice: CopilotVoice;
  /** Une fois par image, après les pas de simulation. Le temps ne compte qu'en course. */
  update: (delta: number, screen: GameScreen) => void;
  /** Redémarrage de la course : coupe la phrase en cours et repart de la première annonce */
  reset: () => void;
  /** Voix coupée, les notes continuent d'être calculées et les icônes de s'afficher */
  setVoiceEnabled: (enabled: boolean) => void;
}

/** Le nom de fichier d'un mot n'est pas toujours son orthographe. */
const WORD_TEXT: Partial<Record<PaceWord, string>> = {
  "se-resserre": "se resserre",
  crete: "crête",
};

const cueText = ({ call, short }: PaceCue): string =>
  callToWords(call, { short })
    .map((word) => WORD_TEXT[word] ?? word)
    .join(" ");

export const createCopilot = (
  sim: CopilotSim,
  audio: CopilotAudio,
  voice: CopilotVoice = createCopilotVoice(audio.voiceBus),
): Copilot => {
  const cue = createPaceNoteCue(sim.track, computePaceNotes(sim.track).calls, {
    durationOf: (call, short) => voice.durationOf(call, { short }),
  });
  let now = 0;
  let voiceEnabled = true;
  let wasMuted = false;
  let wasRacing = false;
  // Phrase coupée par la pause, ou perdue parce que le contexte audio ne tournait pas encore.
  let interrupted = false;

  const contextRunning = (): boolean =>
    audio.voiceBus()?.context.state === "running";

  const speak = ({ call, short }: PaceCue): void => {
    if (!voiceEnabled || audio.isMuted()) return;
    if (contextRunning()) voice.play(call, { short });
    else interrupted = true;
  };

  return {
    voice,
    update: (delta, screen) => {
      // Une phrase en cours ne redevient pas audible au second `M`.
      const muted = audio.isMuted();
      if (muted && !wasMuted) voice.stop();
      wasMuted = muted;

      if (screen !== "race") {
        if (wasRacing) {
          voice.stop();
          interrupted = true;
        }
        wasRacing = false;
        return;
      }
      wasRacing = true;
      now += delta;

      const finished = sim.lap.finished();
      if (finished) voice.stop();
      else if (interrupted && contextRunning()) {
        interrupted = false;
        const again = cue.replay(now);
        if (again) speak(again);
      }

      const { position, speed } = sim.state();
      const next = cue.update({
        x: position.x,
        z: position.z,
        speed,
        now,
        respawnCount: sim.respawnCount(),
        finished,
      });
      if (next) {
        setHudPaceCall(cueText(next));
        speak(next);
      }
      setHudPaceNotes(cue.activeNotes());
    },
    reset: () => {
      cue.reset();
      voice.stop();
      now = 0;
      interrupted = false;
      setHudPaceNotes([]);
      setHudPaceCall(null);
    },
    setVoiceEnabled: (enabled) => {
      voiceEnabled = enabled;
      if (!enabled) voice.stop();
    },
  };
};
