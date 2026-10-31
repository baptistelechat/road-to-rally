"use client";

import { addAfterEffect, useFrame, useThree } from "@react-three/fiber";
import { type RefObject, useEffect, useMemo, useRef } from "react";
import type { CarAudio } from "@/audio/engineAudio";
import { rumbleDiag } from "@/audio/gamepadRumble";
import type { Simulation } from "@/sim/simulation";
import { setHudDiag } from "../hudStore";
import type { LoopInfo } from "../useGameLoop";
import { analyzeDiag } from "./analyze";
import { COLUMN, createDiagHistory, createDiagRecorder } from "./recorder";

// 90 s à 60 images/s, ou 37 s à 144 images/s.
const CAPACITY = 5400;
const AFTER_MARK_MS = 3000;
const WORKER_STALL_MS = 80;
const TOAST_MS = 5000;

// Un second fil qui ne dépend pas du jeu : s'il cale aussi, c'est toute la machine ou le navigateur, pas notre code.
// Le calcul fixe, chaque seconde, sépare les deux causes : plus lent, le processeur ralentit ; aussi rapide, le fil attend son tour.
const WORKER_SOURCE = `
let last = performance.now();
setInterval(() => {
  const now = performance.now();
  if (now - last > ${WORKER_STALL_MS}) postMessage({ at: performance.timeOrigin + now, gap: now - last });
  last = performance.now();
}, 20);
setInterval(() => {
  const start = performance.now();
  let sink = 0;
  for (let i = 0; i < 1000000; i++) sink += Math.sqrt(i);
  postMessage({ cpu: performance.now() - start, sink });
}, 1000);
`;

const heapMb = (): number => {
  const memory = (performance as { memory?: { usedJSHeapSize: number } })
    .memory;
  return memory ? memory.usedJSHeapSize / 1048576 : 0;
};

interface DiagnosticsProps {
  sim: Simulation;
  audio: CarAudio;
  info: RefObject<LoopInfo>;
  captureRef: RefObject<(() => void) | null>;
}

const send = async (report: object): Promise<string> => {
  const body = JSON.stringify(report);
  const response = await fetch("/api/diag", { method: "POST", body }).catch(
    () => null,
  );
  if (response?.ok) return "Diagnostic envoyé";
  // Serveur injoignable ou build de production : on donne le fichier à la place.
  const link = document.createElement("a");
  link.href = URL.createObjectURL(
    new Blob([body], { type: "application/json" }),
  );
  link.download = `diag-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  return "Diagnostic téléchargé";
};

/** Mesure en continu. `captureRef` envoie les 90 dernières secondes et les 3 suivantes. */
export const Diagnostics = ({
  sim,
  audio,
  info,
  captureRef,
}: DiagnosticsProps) => {
  const gl = useThree((state) => state.gl);
  const recorder = useMemo(() => createDiagRecorder(CAPACITY), []);
  const history = useMemo(() => createDiagHistory(), []);
  const timing = useRef({ start: 0, loopEnd: 0, previous: 0 });

  useFrame(() => {
    timing.current.start = performance.now();
  }, -2);
  useFrame(() => {
    timing.current.loopEnd = performance.now();
  }, -0.5);

  useEffect(
    () =>
      addAfterEffect(() => {
        const now = performance.now();
        const { start, loopEnd, previous } = timing.current;
        timing.current.previous = now;
        const state = sim.state();
        const pad = info.current.controller?.debug();
        const applied = info.current.applied;
        const sound = audio.debug();
        const rumble = rumbleDiag(now);
        const { render, memory } = gl.info;
        const { row } = recorder;
        row[COLUMN.t] = now;
        row[COLUMN.frameGap] = previous ? now - previous : 0;
        row[COLUMN.loopMs] = loopEnd - start;
        row[COLUMN.frameMs] = now - start;
        row[COLUMN.steps] = info.current.steps;
        row[COLUMN.padConnected] = pad?.connected ? 1 : 0;
        // `timestamp` ne change que si la manette envoie une valeur différente.
        row[COLUMN.padAge] = pad?.timestamp ? now - pad.timestamp : 0;
        row[COLUMN.steer] = applied.steer;
        row[COLUMN.throttle] = applied.throttle;
        row[COLUMN.brake] = applied.brake;
        row[COLUMN.speed] = state.speed;
        row[COLUMN.rpm] = state.rpm;
        row[COLUMN.s] = sim.lap.currentMs() ?? 0;
        row[COLUMN.audioTime] = sound?.time ?? 0;
        row[COLUMN.audioRunning] = sound?.state === "running" ? 1 : 0;
        row[COLUMN.audioWrites] = sound?.writes ?? 0;
        row[COLUMN.audioUnderruns] = sound?.underruns ?? 0;
        row[COLUMN.rumbleSends] = rumble.sends;
        row[COLUMN.rumblePendingMs] = rumble.pendingMs;
        row[COLUMN.heapMb] = heapMb();
        row[COLUMN.drawCalls] = render.calls;
        row[COLUMN.triangles] = render.triangles;
        row[COLUMN.geometries] = memory.geometries;
        row[COLUMN.textures] = memory.textures;
        recorder.commit();
        history.frame(
          now,
          row[COLUMN.frameGap],
          row[COLUMN.frameMs],
          row[COLUMN.audioUnderruns],
          row[COLUMN.padAge],
        );
      }),
    [audio, gl, history, info, recorder, sim],
  );

  useEffect(() => {
    const log = (type: string, detail?: unknown): void =>
      recorder.event(performance.now(), type, detail);

    const worker = new Worker(
      URL.createObjectURL(
        new Blob([WORKER_SOURCE], { type: "text/javascript" }),
      ),
    );
    worker.onmessage = ({
      data,
    }: MessageEvent<{ at: number; gap: number } | { cpu: number }>) => {
      if ("cpu" in data) {
        history.cpu(data.cpu);
        return;
      }
      history.workerStall(data.gap);
      recorder.event(
        data.at - performance.timeOrigin,
        "workerStall",
        Math.round(data.gap),
      );
    };

    const observers: PerformanceObserver[] = [];
    const observe = (entryType: string, name: string): void => {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries())
            recorder.event(entry.startTime, name, Math.round(entry.duration));
        });
        observer.observe({ type: entryType, buffered: false });
        observers.push(observer);
      } catch {
        // Type non pris en charge par ce navigateur : on s'en passe.
      }
    };
    observe("longtask", "longTask");
    observe("long-animation-frame", "longFrame");

    const onPadOn = (event: GamepadEvent): void =>
      log("padConnected", event.gamepad.id);
    const onPadOff = (event: GamepadEvent): void =>
      log("padDisconnected", event.gamepad.id);
    const onBlur = (): void => log("blur");
    const onFocus = (): void => log("focus");
    const onVisibility = (): void =>
      log("visibility", document.visibilityState);
    const onContextLost = (): void => log("webglContextLost");
    window.addEventListener("gamepadconnected", onPadOn);
    window.addEventListener("gamepaddisconnected", onPadOff);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    gl.domElement.addEventListener("webglcontextlost", onContextLost);

    return () => {
      worker.terminate();
      for (const observer of observers) observer.disconnect();
      window.removeEventListener("gamepadconnected", onPadOn);
      window.removeEventListener("gamepaddisconnected", onPadOff);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      gl.domElement.removeEventListener("webglcontextlost", onContextLost);
    };
  }, [gl, history, recorder]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let busy = false;
    const toast = (message: string | null): void => setHudDiag(message);
    const capture = (): void => {
      recorder.event(performance.now(), "mark");
      if (busy) return;
      busy = true;
      toast("Diagnostic : capture en cours…");
      timer = setTimeout(() => {
        const data = recorder.data();
        const report = {
          capturedAt: new Date().toISOString(),
          page: location.href,
          userAgent: navigator.userAgent,
          cores: navigator.hardwareConcurrency,
          screen: [innerWidth, innerHeight, devicePixelRatio],
          pad: info.current.controller?.debug() ?? null,
          audio: audio.debug(),
          summary: analyzeDiag(data),
          history: history.rows(),
          ...data,
        };
        void send(report).then((message) => {
          busy = false;
          toast(message);
          timer = setTimeout(() => toast(null), TOAST_MS);
        });
      }, AFTER_MARK_MS);
    };
    captureRef.current = capture;
    return () => {
      clearTimeout(timer);
      captureRef.current = null;
    };
  }, [audio, captureRef, history, info, recorder]);

  return null;
};
