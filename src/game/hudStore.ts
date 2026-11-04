// État du HUD. Poussé à environ 10 Hz, pour ne pas refaire le rendu React à chaque pas de simulation.
import { create } from "zustand";
import type { RecoveryStatus } from "@/sim/recovery";
import type { PaceNote } from "@/sim/track/paceNotes";
import type { CarState } from "@/sim/types";
import {
  type CopilotOptions,
  loadCopilotOptions,
  saveCopilotOptions,
} from "./copilotOptions";

export const HUD_PERIOD_MS = 100;
/** Icônes de virage affichées au plus */
const PACE_ICONS = 3;

export interface HudPaceCall {
  text: string;
  /** Deux annonces identiques à la suite restent deux annonces pour un lecteur d'écran */
  id: number;
}

export interface LapTimes {
  lapMs: number | null;
  lastLapMs: number | null;
  bestLapMs: number | null;
}

export type GameScreen = "start" | "race" | "pause";

export interface HudPaceChain {
  start: number;
  end: number;
  open: boolean;
}

export interface HudState extends LapTimes {
  speedKmh: number;
  gear: number;
  rpm: number;
  /** 0 à 1, comme `CarState` */
  throttle: number;
  brake: number;
  muted: boolean;
  /** Hors de la course, le menu est affiché et la simulation reste gelée */
  screen: GameScreen;
  device: "keyboard" | "gamepad";
  recovery: RecoveryStatus | null;
  /** Message du mode diagnostic */
  diag: string | null;
  /** Arrivée franchie sur une spéciale */
  finished: boolean;
  /** Prochains virages annoncés, le plus proche d'abord */
  paceNotes: readonly PaceNote[];
  /** Enfilade parmi ces notes : indices de sa première et de sa dernière, et `open` si elle continue au-delà de la bande */
  paceChain: HudPaceChain | null;
  /** Dernière annonce, en toutes lettres */
  paceCall: HudPaceCall | null;
  copilotOptions: CopilotOptions;
}

export const useHudStore = create<HudState>(() => ({
  speedKmh: 0,
  gear: 0,
  rpm: 0,
  throttle: 0,
  brake: 0,
  muted: false,
  screen: "start",
  device: "keyboard",
  recovery: null,
  diag: null,
  finished: false,
  paceNotes: [],
  paceChain: null,
  paceCall: null,
  copilotOptions: loadCopilotOptions(),
  lapMs: null,
  lastLapMs: null,
  bestLapMs: null,
}));

let lastPushAt = Number.NEGATIVE_INFINITY;

/** Appelable à chaque image : au-delà de 10 Hz, l'appel est ignoré. */
export const pushHud = (
  state: CarState,
  now: number = performance.now(),
): void => {
  if (now - lastPushAt < HUD_PERIOD_MS) return;
  lastPushAt = now;
  // Arrondis : sans eux, le moindre frémissement du régime referait le rendu du compteur.
  const next = {
    speedKmh: Math.round(state.speed * 3.6),
    gear: state.gear,
    rpm: Math.round(state.rpm / 50) * 50,
    throttle: Math.round(state.throttle * 20) / 20,
    brake: Math.round(state.brake * 20) / 20,
  };
  const current = useHudStore.getState();
  if (
    (Object.keys(next) as (keyof typeof next)[]).every(
      (key) => current[key] === next[key],
    )
  )
    return;
  useHudStore.setState(next);
};

/** Appelable à chaque image : le chrono en cours n'est republié que tous les 100 ms. */
export const setLapTimes = (times: Partial<LapTimes>): void => {
  const current = useHudStore.getState();
  const { lapMs = current.lapMs } = times;
  const { lastLapMs = current.lastLapMs, bestLapMs = current.bestLapMs } =
    times;
  const sameLaps =
    lastLapMs === current.lastLapMs && bestLapMs === current.bestLapMs;
  const lapRunning =
    lapMs !== null &&
    current.lapMs !== null &&
    lapMs >= current.lapMs &&
    lapMs - current.lapMs < HUD_PERIOD_MS;
  if (sameLaps && (lapRunning || lapMs === current.lapMs)) return;
  useHudStore.setState({ lapMs, lastLapMs, bestLapMs });
};

export const setHudMuted = (muted: boolean): void => {
  useHudStore.setState({ muted });
};

/** Appelable à chaque image. */
export const setHudScreen = (screen: GameScreen): void => {
  if (useHudStore.getState().screen !== screen)
    useHudStore.setState({ screen });
};

/**
 * Effet d'une pression de Start. Dans les menus, A active la ligne sélectionnée : voir `applyMenuAction`.
 * Au départ, la manette est refusée tant que le son est bloqué : le joueur roulerait sans savoir pourquoi c'est silencieux.
 */
export const nextScreen = (
  screen: GameScreen,
  soundBlocked: boolean,
  startPressed: boolean,
): GameScreen => {
  if (!startPressed) return screen;
  if (screen === "race") return "pause";
  return screen === "start" && soundBlocked ? "start" : "race";
};

export const setHudDevice = (device: HudState["device"]): void => {
  if (useHudStore.getState().device !== device)
    useHudStore.setState({ device });
};

/** Appelable à chaque image : le décompte n'est republié qu'au dixième de seconde. */
export const setHudRecovery = (status: RecoveryStatus | null): void => {
  const current = useHudStore.getState().recovery;
  if (
    current?.kind === status?.kind &&
    Math.ceil((current?.remaining ?? 0) * 10) ===
      Math.ceil((status?.remaining ?? 0) * 10)
  )
    return;
  useHudStore.setState({ recovery: status });
};

export const setHudDiag = (diag: string | null): void => {
  useHudStore.setState({ diag });
};

/** Appelable à chaque image. */
export const setHudFinished = (finished: boolean): void => {
  if (useHudStore.getState().finished !== finished)
    useHudStore.setState({ finished });
};

/**
 * Appelable à chaque image : seul un changement de la liste affichée met à jour le HUD.
 * `chain` : notes de l'enfilade annoncée, passées comprises.
 */
export const setHudPaceNotes = (
  notes: readonly PaceNote[],
  chain: readonly PaceNote[] | null = null,
): void => {
  const { paceNotes: current, paceChain: currentChain } =
    useHudStore.getState();
  const shown = notes.slice(0, PACE_ICONS);
  // ponytail: un seul cadre. Deux enfilades dans 3 icônes demandent deux annonces de 3 virages collées ; la seconde s'affiche alors sans cadre.
  const chained = new Set(chain);
  const inChain = shown.flatMap((note, i) => (chained.has(note) ? [i] : []));
  const paceChain =
    inChain.length > 0
      ? {
          start: inChain[0],
          end: inChain[inChain.length - 1],
          open: notes.slice(PACE_ICONS).some((note) => chained.has(note)),
        }
      : null;
  if (
    shown.length !== current.length ||
    shown.some((note, i) => note !== current[i]) ||
    paceChain?.start !== currentChain?.start ||
    paceChain?.end !== currentChain?.end ||
    paceChain?.open !== currentChain?.open
  )
    useHudStore.setState({ paceNotes: shown, paceChain });
};

let paceCallId = 0;

export const setHudPaceCall = (text: string | null): void => {
  useHudStore.setState({
    paceCall: text === null ? null : { text, id: ++paceCallId },
  });
};

/** Choix du joueur : seul cet appel écrit dans le stockage, le chargement d'une session n'y touche pas. */
export const setCopilotOptions = (copilotOptions: CopilotOptions): void => {
  saveCopilotOptions(copilotOptions);
  useHudStore.setState({ copilotOptions });
};

let restartRequested = false;

/** Bouton du HUD : la boucle de jeu applique la demande au prochain passage. */
export const requestRestart = (): void => {
  restartRequested = true;
};

export const consumeRestartRequest = (): boolean => {
  const requested = restartRequested;
  restartRequested = false;
  return requested;
};
