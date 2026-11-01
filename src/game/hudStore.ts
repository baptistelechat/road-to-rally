// État du HUD. Poussé à environ 10 Hz, pour ne pas refaire le rendu React à chaque pas de simulation.
import { create } from "zustand";
import type { RecoveryStatus } from "@/sim/recovery";
import type { CarState } from "@/sim/types";

export const HUD_PERIOD_MS = 100;

export interface LapTimes {
  lapMs: number | null;
  lastLapMs: number | null;
  bestLapMs: number | null;
}

export type GameScreen = "start" | "race" | "pause";

export interface HudState extends LapTimes {
  speedKmh: number;
  gear: number;
  muted: boolean;
  /** Hors de la course, le menu est affiché et la simulation reste gelée */
  screen: GameScreen;
  device: "keyboard" | "gamepad";
  recovery: RecoveryStatus | null;
  /** Message du mode diagnostic */
  diag: string | null;
  /** Arrivée franchie sur une spéciale */
  finished: boolean;
}

export const useHudStore = create<HudState>(() => ({
  speedKmh: 0,
  gear: 0,
  muted: false,
  screen: "start",
  device: "keyboard",
  recovery: null,
  diag: null,
  finished: false,
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
  const speedKmh = Math.round(state.speed * 3.6);
  const current = useHudStore.getState();
  if (current.speedKmh === speedKmh && current.gear === state.gear) return;
  useHudStore.setState({ speedKmh, gear: state.gear });
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
 * Effet d'une pression de A ou de Start sur le menu.
 * Au départ, la manette est refusée tant que le son est bloqué : le joueur roulerait sans savoir pourquoi c'est silencieux.
 */
export const nextScreen = (
  screen: GameScreen,
  soundBlocked: boolean,
  confirmPressed: boolean,
  startPressed: boolean,
): GameScreen => {
  if (screen === "race") return startPressed ? "pause" : "race";
  if (!confirmPressed && !startPressed) return screen;
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
