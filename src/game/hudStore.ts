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

export interface HudState extends LapTimes {
  speedKmh: number;
  gear: number;
  muted: boolean;
  device: "keyboard" | "gamepad";
  recovery: RecoveryStatus | null;
  /** Message du mode diagnostic */
  diag: string | null;
}

export const useHudStore = create<HudState>(() => ({
  speedKmh: 0,
  gear: 0,
  muted: false,
  device: "keyboard",
  recovery: null,
  diag: null,
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
