import { useEffect, useRef } from "react";
import { resolveContext } from "@/audio/engineAudio";
import { enginePreset, type EnginePresetId } from "@/audio/enginePresets";
import { createEngineVoice } from "@/audio/engineVoice";
import { carConfig } from "@/sim/carConfig";
import { createDemo, createRevState } from "../labo-son/revSim";

const MAX_FRAME_S = 0.1;

/** Joue la séquence de démo du moteur choisi. Chaque nouvel objet `demo` la relance depuis le début. */
export const useEngineDemo = (
  demo: { engine: EnginePresetId } | null,
  onEnd: () => void,
): void => {
  const contextRef = useRef<AudioContext | null>(null);
  const busRef = useRef<AudioNode | null>(null);

  useEffect(() => {
    if (!demo) return;
    if (!contextRef.current) {
      const created = resolveContext();
      if (!created) {
        onEnd();
        return;
      }
      const compressor = created.createDynamicsCompressor();
      compressor.connect(created.destination);
      contextRef.current = created;
      busRef.current = compressor;
    }
    const context = contextRef.current;
    const bus = busRef.current;
    if (!bus) return;
    context.resume().catch(() => undefined);
    const voice = createEngineVoice(
      context,
      bus,
      enginePreset(demo.engine),
      carConfig.engine,
    );
    const rev = createRevState();
    const run = createDemo();
    let frame = 0;
    let last: number | null = null;
    const tick = (time: number): void => {
      frame = requestAnimationFrame(tick);
      const dt =
        last === null ? 0 : Math.min(MAX_FRAME_S, (time - last) / 1000);
      last = time;
      // Son encore bloqué par le navigateur : la démo attend le premier geste au lieu de défiler en silence.
      if (context.state !== "running") return;
      if (run.step(rev, dt)) voice.update(rev.rpm, rev.throttle, dt);
      else onEnd();
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      voice.dispose();
    };
  }, [demo, onEnd]);

  // Une manette ne débloque pas le son : le premier clic ou la première touche lance la démo en attente.
  // Onglet caché : la boucle s'arrête, le moteur resterait bloqué sur sa dernière note.
  useEffect(() => {
    const resume = (): void => {
      contextRef.current?.resume().catch(() => undefined);
    };
    const onVisibility = (): void => {
      if (document.hidden) contextRef.current?.suspend().catch(() => undefined);
      else resume();
    };
    window.addEventListener("pointerup", resume);
    window.addEventListener("keydown", resume);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pointerup", resume);
      window.removeEventListener("keydown", resume);
      document.removeEventListener("visibilitychange", onVisibility);
      contextRef.current?.close().catch(() => undefined);
      contextRef.current = null;
      busRef.current = null;
    };
  }, []);
};
