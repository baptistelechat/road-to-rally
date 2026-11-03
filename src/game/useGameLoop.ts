"use client";

import { useFrame } from "@react-three/fiber";
import { type RefObject, useEffect, useMemo, useRef } from "react";
import { Quaternion } from "three";
import type { CarAudio } from "@/audio/engineAudio";
import { updateRumble } from "@/audio/gamepadRumble";
import {
  createInputController,
  findStandardPad,
  type InputController,
} from "@/input/inputController";
import { createInputRecorder } from "@/input/recorder";
import {
  type MenuRepeat,
  pollMenuRepeat,
  readCameraOrbit,
  readMenuAction,
} from "@/input/smoothing";
import type { CarSource } from "@/render/carSource";
import { botInput } from "@/sim/bot";
import { createFixedStepper, FIXED_DT } from "@/sim/fixedStep";
import type { Simulation } from "@/sim/simulation";
import { NEUTRAL_INPUT, type CarInput, type Pose } from "@/sim/types";
import type { Copilot } from "./copilot";
import {
  consumeRestartRequest,
  pushHud,
  setHudDevice,
  setHudFinished,
  setHudMuted,
  setHudRecovery,
  nextScreen,
  setHudScreen,
  setLapTimes,
  useHudStore,
} from "./hudStore";
import { applyMenuAction } from "./Hud/applyMenuAction";

const START_BUTTON = 9;

const readBestLap = (key: string): number | null => {
  try {
    const value = Number(localStorage.getItem(key));
    return value > 0 ? value : null;
  } catch {
    return null;
  }
};

const writeBestLap = (key: string, ms: number): void => {
  try {
    localStorage.setItem(key, String(ms));
  } catch {
    // ponytail: stockage bloqué, le meilleur temps vit juste le temps de la session
  }
};

interface GameLoopOptions {
  sim: Simulation;
  audio: CarAudio;
  copilot: Copilot;
  useBot: boolean;
  /** Clé `localStorage` du meilleur temps de la carte */
  bestLapKey: string;
  onToggleCamera: () => void;
  onDiagRequest: () => void;
}

/** Ce que la boucle expose au mode diagnostic. */
export interface LoopInfo {
  controller: InputController | null;
  applied: CarInput;
  steps: number;
}

/** Boucle à pas fixe et rendu interpolé. Doit tourner avant les composants qui lisent `CarSource`. */
export const useGameLoop = ({
  sim,
  audio,
  copilot,
  useBot,
  bestLapKey,
  onToggleCamera,
  onDiagRequest,
}: GameLoopOptions): {
  source: CarSource;
  info: RefObject<LoopInfo>;
  cameraOrbit: RefObject<number>;
} => {
  const stepper = useMemo(() => createFixedStepper(), []);
  const recorder = useRef(createInputRecorder());
  const controller = useRef<ReturnType<typeof createInputController> | null>(
    null,
  );
  const info = useRef<LoopInfo>({
    controller: null,
    applied: NEUTRAL_INPUT,
    steps: 0,
  });
  const cameraOrbit = useRef(0);
  const bestLap = useRef<number | null>(null);
  const lastLap = useRef<number | null>(null);
  // Tenu au départ : le bouton qui a réveillé la manette ne déclenche rien.
  const startHeld = useRef(true);
  const menuRepeat = useRef<MenuRepeat>({ held: undefined, wait: 0 });
  const pose = useRef<Pose>({
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
  });
  const quats = useMemo(
    () => ({ a: new Quaternion(), b: new Quaternion(), out: new Quaternion() }),
    [],
  );

  useEffect(() => {
    const input = createInputController(window);
    const loop = info.current;
    controller.current = input;
    loop.controller = input;
    bestLap.current = readBestLap(bestLapKey);
    setLapTimes({ bestLapMs: bestLap.current });
    return () => {
      input.dispose();
      controller.current = null;
      loop.controller = null;
    };
  }, [bestLapKey]);

  const restart = (): void => {
    sim.restart();
    copilot.reset();
    recorder.current = createInputRecorder();
    lastLap.current = null;
  };

  useFrame((_, delta) => {
    const input = controller.current;
    info.current.steps = 0;
    const pad = findStandardPad(window);
    const start = pad?.buttons[START_BUTTON]?.pressed ?? false;
    const soundBlocked = audio.isBlocked();
    const screen = nextScreen(
      useHudStore.getState().screen,
      soundBlocked,
      start && !startHeld.current,
    );
    startHeld.current = start;
    setHudScreen(screen);
    audio.setPaused(screen === "pause");
    // Relevé aussi en course : un A tenu (frein à main) à l'ouverture du menu ne clique sur rien.
    const menuAction = pad
      ? pollMenuRepeat(menuRepeat.current, readMenuAction(pad), delta)
      : null;
    if (!pad) menuRepeat.current.held = undefined;
    if (menuAction && screen !== "race" && document.hasFocus())
      applyMenuAction(menuAction, soundBlocked);
    cameraOrbit.current =
      pad && screen === "race" && document.hasFocus()
        ? readCameraOrbit(pad)
        : 0;
    // Dans les menus, ni voiture ni chrono.
    const alpha = stepper.advance(screen === "race" ? delta : 0, () => {
      const sampled: CarInput = input?.sample(FIXED_DT) ?? NEUTRAL_INPUT;
      const applied = useBot ? botInput(sim.state(), sim.track, sim.routeS()) : sampled;
      recorder.current.record(applied);
      info.current.applied = applied;
      info.current.steps++;
      const lapMs = sim.step(applied);
      if (lapMs !== null) {
        // Une manette analogique change à chaque pas : sans ça, l'enregistrement grossirait sans fin.
        recorder.current = createInputRecorder();
        lastLap.current = lapMs;
        if (bestLap.current === null || lapMs < bestLap.current) {
          bestLap.current = lapMs;
          writeBestLap(bestLapKey, lapMs);
        }
      }
    });

    for (const action of input?.consumeActions() ?? []) {
      if (action === "camera") onToggleCamera();
      if (action === "mute") setHudMuted(audio.toggleMute());
      if (action === "restart") restart();
      if (action === "diag") onDiagRequest();
      if (action === "pause") {
        // Échap suit B : d'abord la liste et le panneau, puis la course.
        if (screen === "race") setHudScreen("pause");
        else applyMenuAction("cancel", soundBlocked);
      }
    }
    if (consumeRestartRequest()) restart();

    // Rendu interpolé entre les deux derniers pas.
    const from = sim.previousPose();
    const to = sim.state();
    const p = pose.current.position;
    p.x = from.position.x + (to.position.x - from.position.x) * alpha;
    p.y = from.position.y + (to.position.y - from.position.y) * alpha;
    p.z = from.position.z + (to.position.z - from.position.z) * alpha;
    const { a, b, out } = quats;
    a.set(from.rotation.x, from.rotation.y, from.rotation.z, from.rotation.w);
    b.set(to.rotation.x, to.rotation.y, to.rotation.z, to.rotation.w);
    out.slerpQuaternions(a, b, alpha);
    const r = pose.current.rotation;
    r.x = out.x;
    r.y = out.y;
    r.z = out.z;
    r.w = out.w;

    audio.update(to, delta);
    copilot.update(delta, screen);
    // Hors course, l'état figé vibrerait sans fin.
    if (screen === "race") updateRumble(to);
    pushHud(to);
    setHudRecovery(sim.recovery());
    if (input) setHudDevice(input.activeDevice());
    setHudFinished(sim.lap.finished());
    setLapTimes({
      lapMs: sim.lap.currentMs(),
      lastLapMs: lastLap.current,
      bestLapMs: bestLap.current,
    });
  }, -1);

  const source = useMemo<CarSource>(
    () => ({
      getState: () => sim.state(),
      getPose: () => pose.current,
      getRespawnCount: () => sim.respawnCount(),
    }),
    [sim],
  );
  return { source, info, cameraOrbit };
};
