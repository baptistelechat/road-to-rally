"use client";

import { useFrame } from "@react-three/fiber";
import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { Quaternion } from "three";
import type { CarAudio } from "@/audio/engineAudio";
import { createCountdownBeep } from "@/audio/countdownBeep";
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
import {
  createPoseRecorder,
  type GhostPlayer,
} from "@/sim/ghostTrack";
import type { Simulation } from "@/sim/simulation";
import { createSplitTracker, raceCourse, splitDelta } from "@/sim/splits";
import { NEUTRAL_INPUT, type CarInput, type Pose } from "@/sim/types";
import type { Copilot } from "./copilot";
import type { GhostOutlet } from "./ghostOutlet";
import {
  consumeRestartRequest,
  pushHud,
  setHudCountdown,
  setHudDevice,
  setHudMuted,
  setHudPenalty,
  setHudRecovery,
  setHudResult,
  nextScreen,
  setHudScreen,
  setHudSplit,
  setHudStrip,
  setLapTimes,
  useHudStore,
} from "./hudStore";
import {
  buildStrip,
  createCircuitProgress,
  lapS,
  PENALTY_REASONS,
  referenceSplits,
  sectorDeltas,
} from "./raceProgress";
import {
  isNewRecord,
  type RecordIdentity,
  type StageRecord,
  writeStageRecord,
} from "./stageRecords";
import { applyMenuAction } from "./Hud/applyMenuAction";

const START_BUTTON = 9;

/** Durée d'affichage d'un écart d'intermédiaire ou d'une pénalité, décomptée en course seulement */
const SPLIT_DISPLAY_S = 3;
const PENALTY_DISPLAY_S = 3;

interface GameLoopOptions {
  sim: Simulation;
  audio: CarAudio;
  copilot: Copilot;
  useBot: boolean;
  /** Identité de la spéciale, pour son meilleur temps local */
  identity: RecordIdentity;
  /** Meilleur temps local lu au chargement, `null` sans record */
  record: StageRecord | null;
  /** Fantôme du record à afficher, `null` sans fantôme ou option coupée */
  ghost: GhostPlayer | null;
  /** Nouveau meilleur temps, déjà écrit : le fantôme suivant en vient */
  onRecord: (record: StageRecord) => void;
  /** Reçoit la pose du fantôme à chaque image, pour la mini-carte hors du canvas */
  ghostOutlet: GhostOutlet;
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
  identity,
  record,
  ghost,
  onRecord,
  ghostOutlet,
  onToggleCamera,
  onDiagRequest,
}: GameLoopOptions): {
  source: CarSource;
  ghostSource: Pick<CarSource, "getPose">;
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
  const best = useRef<StageRecord | null>(record);
  // Portion chronométrée : la spéciale, ou un tour du circuit depuis la ligne.
  const course = useMemo(() => raceCourse(sim.track), [sim]);
  const splits = useMemo(() => createSplitTracker(course), [course]);
  const circuit = useMemo(
    () => (sim.track.closed ? createCircuitProgress(sim.track, course) : null),
    [sim, course],
  );
  // Abscisse de la voiture sur `course`, pour les intermédiaires et la frise.
  const carS = useRef(course.startS);
  const splitLeft = useRef(0);
  const [beep] = useState(() => createCountdownBeep(audio.effectsBus));
  useEffect(() => () => beep.dispose(), [beep]);
  const penaltyLeft = useRef(0);
  const lastPenaltyId = useRef(0);
  // Abscisse suivie du fantôme : sur un aller-retour, sa position seule ne dit pas quel passage.
  const ghostS = useRef(course.startS);
  // Temps d'arrivée de la course en cours, pour colorer le dernier secteur.
  const finishMs = useRef<number | null>(null);
  const poseRecorder = useRef(createPoseRecorder());
  const ghostPose = useRef<Pose | null>(null);
  // Premier tour depuis le redémarrage : seules ces entrées sont rejouables.
  const fromRestart = useRef(true);
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
    return () => {
      input.dispose();
      controller.current = null;
      loop.controller = null;
    };
  }, []);

  useEffect(() => {
    best.current = record;
    setLapTimes({ bestLapMs: record?.totalMs ?? null });
  }, [record]);

  const restart = (): void => {
    sim.restart();
    beep.reset();
    copilot.reset();
    recorder.current = createInputRecorder();
    poseRecorder.current = createPoseRecorder();
    fromRestart.current = true;
    splits.reset();
    circuit?.reset();
    carS.current = course.startS;
    splitLeft.current = 0;
    penaltyLeft.current = 0;
    lastPenaltyId.current = 0;
    ghostS.current = course.startS;
    finishMs.current = null;
    setHudPenalty(null);
    lastLap.current = null;
    setHudSplit(null);
    setHudResult(null);
  };

  /** Frise à l'instant : `reference` est le record d'avant cette course, même une fois battu. */
  const stripNow = (reference: StageRecord | null) => {
    const times = [...splits.times()];
    if (finishMs.current !== null) times.push(finishMs.current);
    return buildStrip(
      course,
      splits.gates,
      sectorDeltas(
        splits.gates.length + 1,
        times,
        referenceSplits(reference, splits.gates, course),
        reference?.totalMs ?? null,
      ),
      carS.current,
      ghostPose.current ? ghostS.current : null,
    );
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
    // Dans les menus, ni voiture ni chrono. Derrière le résultat, la voiture finit de freiner.
    const running = screen === "race" || screen === "result";
    const alpha = stepper.advance(running ? delta : 0, () => {
      const sampled: CarInput = input?.sample(FIXED_DT) ?? NEUTRAL_INPUT;
      const applied = useBot ? botInput(sim.state(), sim.track, sim.routeS()) : sampled;
      recorder.current.record(applied);
      info.current.applied = applied;
      info.current.steps++;
      const lapMs = sim.step(applied);
      const elapsedMs = sim.lap.currentMs();
      // Le pas qui renvoie le temps d'arrivée est enregistré, même si `finished()` vaut déjà vrai.
      if (elapsedMs !== null && (!sim.lap.finished() || lapMs !== null))
        poseRecorder.current.record(sim.state(), sim.respawnCount());
      const { x, z } = sim.state().position;
      carS.current = circuit
        ? circuit.update(x, z, sim.lap.checkpoints())
        : sim.routeS();
      const crossing = splits.update(carS.current, elapsedMs);
      if (crossing) {
        setHudSplit({
          ...crossing,
          deltaMs: splitDelta(
            referenceSplits(best.current, splits.gates, course) ??
              undefined,
            crossing,
          ),
        });
        splitLeft.current = SPLIT_DISPLAY_S;
      }
      const penalty = sim.lastPenalty();
      if (penalty && penalty.id !== lastPenaltyId.current) {
        lastPenaltyId.current = penalty.id;
        // Le fantôme de cette course s'arrêtera ici le temps de la pénalité.
        poseRecorder.current.penalty(penalty.ms);
        setHudPenalty({
          reason: PENALTY_REASONS[penalty.reason],
          ms: penalty.ms,
          id: penalty.id,
        });
        penaltyLeft.current = PENALTY_DISPLAY_S;
      }
      if (lapMs !== null) {
        const previous = best.current;
        const ghostData = poseRecorder.current.build(
          fromRestart.current ? recorder.current.frames() : undefined,
        );
        // Une manette analogique change à chaque pas : sans ça, l'enregistrement grossirait sans fin.
        recorder.current = createInputRecorder();
        poseRecorder.current = createPoseRecorder();
        fromRestart.current = false;
        lastLap.current = lapMs;
        const isBest = isNewRecord(previous, lapMs);
        if (isBest) {
          const next: StageRecord = {
            version: 1,
            totalMs: lapMs,
            splitsMs: [...splits.times()],
            date: new Date().toISOString(),
            ...(ghostData ? { ghost: ghostData } : {}),
          };
          // ponytail: stockage bloqué, le record vit le temps de la session
          best.current = writeStageRecord(identity, next) ?? next;
          onRecord(best.current);
        }
        // Circuit : chaque tour repart avec ses intermédiaires.
        if (circuit) {
          splits.reset();
          circuit.reset();
          carS.current = course.startS;
        } else {
          finishMs.current = lapMs;
          setHudStrip(stripNow(previous), true);
          const times = [...splits.times(), lapMs];
          const deltas = sectorDeltas(
            times.length,
            times,
            referenceSplits(previous, splits.gates, course),
            previous?.totalMs ?? null,
          );
          setHudResult({
            sectors: times.map((ms, i) => ({
              ms: ms - (i === 0 ? 0 : times[i - 1]),
              deltaMs: deltas[i] ?? null,
            })),
            totalMs: lapMs,
            penaltyMs: sim.lap.penaltyMs(),
            deltaMs: previous === null ? null : lapMs - previous.totalMs,
            isBest,
          });
          setHudScreen("result");
        }
      }
    });

    if (screen === "race" && splitLeft.current > 0) {
      splitLeft.current -= delta;
      if (splitLeft.current <= 0) setHudSplit(null);
    }
    if (screen === "race" && penaltyLeft.current > 0) {
      penaltyLeft.current -= delta;
      if (penaltyLeft.current <= 0) setHudPenalty(null);
    }

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

    // Fantôme calé sur le chrono officiel, interpolé comme la voiture : chaque pénalité du joueur le fait avancer
    // d'autant, et il s'arrête sur les siennes. Devant sur la route veut dire devant au chrono.
    const driven = poseRecorder.current.count();
    ghostPose.current =
      ghost && driven > 0
        ? ghost.poseAt(
            (driven - 1 + alpha) * FIXED_DT * 1000 + sim.lap.penaltyMs(),
          )
        : null;
    ghostOutlet.setPose(ghostPose.current);
    if (ghostPose.current) {
      const { x, z } = ghostPose.current.position;
      const s = sim.track.nearest(x, z, circuit ? undefined : ghostS.current).s;
      ghostS.current = circuit ? lapS(sim.track, course, s) : s;
    }

    audio.update(to, delta);
    copilot.update(delta, screen);
    // Hors course, l'état figé vibrerait sans fin.
    if (screen === "race") updateRumble(to);
    pushHud(to);
    setHudRecovery(sim.recovery());
    if (input) setHudDevice(input.activeDevice());
    const countdown = sim.countdown();
    beep.update(countdown);
    setHudCountdown(countdown);
    if (finishMs.current === null) setHudStrip(stripNow(best.current));
    setLapTimes({
      lapMs: sim.lap.currentMs(),
      lastLapMs: lastLap.current,
      bestLapMs: best.current?.totalMs ?? null,
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
  const ghostSource = useMemo(() => ({ getPose: () => ghostPose.current }), []);
  return { source, ghostSource, info, cameraOrbit };
};
