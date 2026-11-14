// Bips du départ arrêté, synthétisés : un court par seconde du décompte, un plus aigu et plus long au GO.
import { COUNTDOWN_S } from "@/sim/simulation";
import type { VoiceBus } from "./copilotVoice";

/** Le décompte vaut `COUNTDOWN_S` tant que la simulation n'a pas fait son premier pas : pas encore parti. */
const NOT_STARTED_EPS = 0.001;

/**
 * Feux rouges allumés pour un décompte en cours : 0 avant le premier pas, puis 1, 2, 3 à chaque seconde.
 * Partagé avec la rampe de feux pour que son et lumière changent sur la même image.
 */
export const redLightsOn = (seconds: number): number =>
  seconds >= COUNTDOWN_S - NOT_STARTED_EPS
    ? 0
    : Math.min(3, Math.max(1, 4 - Math.ceil(seconds)));

interface Tone {
  frequency: number;
  /** Durée tenue avant l'extinction, en secondes */
  holdS: number;
}

const COUNT_TONE: Tone = { frequency: 880, holdS: 0.12 };
const GO_TONE: Tone = { frequency: 1760, holdS: 0.5 };
const PEAK = 0.35;
const ATTACK_TC = 0.004;
const RELEASE_TC = 0.03;

export interface CountdownBeep {
  /** À chaque image avec `sim.countdown()` : bipe au changement de seconde et au passage à `null` */
  update: (seconds: number | null) => void;
  /** Au redémarrage : oublie l'état, pour que le prochain décompte bipe dès sa première seconde */
  reset: () => void;
  dispose: () => void;
}

/** @param getBus où brancher les bips, `null` tant que le contexte n'existe pas */
export const createCountdownBeep = (
  getBus: () => VoiceBus | null,
): CountdownBeep => {
  let lit = 0;
  const playing = new Set<OscillatorNode>();

  const beep = ({ frequency, holdS }: Tone): void => {
    const bus = getBus();
    // Contexte suspendu (pause, onglet caché) : le bip partirait à la reprise, hors de propos.
    if (!bus || bus.context.state !== "running") return;
    const { context, output } = bus;
    const now = context.currentTime;
    const gain = context.createGain();
    gain.gain.value = 0;
    gain.connect(output);
    const osc = context.createOscillator();
    // Carré adouci par l'enveloppe : plus proche d'un buzzer de chronométrage qu'un sinus.
    osc.type = "square";
    osc.frequency.value = frequency;
    osc.connect(gain);
    gain.gain.setTargetAtTime(PEAK, now, ATTACK_TC);
    gain.gain.setTargetAtTime(0, now + holdS, RELEASE_TC);
    osc.start(now);
    osc.stop(now + holdS + RELEASE_TC * 6);
    playing.add(osc);
    osc.onended = () => {
      playing.delete(osc);
      osc.disconnect();
      gain.disconnect();
    };
  };

  return {
    update: (seconds) => {
      if (seconds === null) {
        // GO seulement à la fin d'un décompte : rien si l'on démarre déjà parti, ni sur le circuit.
        if (lit > 0) beep(GO_TONE);
        lit = 0;
        return;
      }
      const next = redLightsOn(seconds);
      if (next > 0 && next !== lit) beep(COUNT_TONE);
      lit = next;
    },
    reset: () => {
      lit = 0;
    },
    dispose: () => {
      for (const osc of playing) osc.stop();
      playing.clear();
    },
  };
};
