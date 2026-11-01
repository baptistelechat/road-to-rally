import { useEffect, useRef, useState } from "react";
import { ENGINE_PRESETS, type EnginePresetId } from "@/audio/enginePresets";
import {
  createEngineVoice,
  DEFAULT_LAYERS,
  type EngineLayer,
  type EngineLayers,
  type EngineVoice,
} from "@/audio/engineVoice";
import { carConfig } from "@/sim/carConfig";
import {
  createDemo,
  createRevState,
  MANUAL_GEAR,
  stepRev,
  type Demo,
  type RevState,
} from "./revSim";

const { idleRpm, redlineRpm } = carConfig.engine;
const MAX_FRAME_S = 0.1;

/** Fait tourner le moteur choisi : régime simulé à chaque image, voix audio et commandes du labo. */
export const useSoundLab = () => {
  const [presetId, setPresetId] = useState<EnginePresetId | null>(null);
  const [layers, setLayers] = useState<EngineLayers>(DEFAULT_LAYERS);
  const [rpm, setRpm] = useState(idleRpm);
  const [throttleLevel, setThrottleLevel] = useState(0);
  const [gasHeld, setGasHeld] = useState(false);
  const [demoRunning, setDemoRunning] = useState(false);

  const contextRef = useRef<AudioContext | null>(null);
  const busRef = useRef<AudioNode | null>(null);
  const voiceRef = useRef<EngineVoice | null>(null);
  const layersRef = useRef(layers);
  // Créé à la première lecture : ce composant se réaffiche à chaque image.
  const revRef = useRef<RevState | null>(null);
  const demoRef = useRef<Demo | null>(null);
  const heldRpmRef = useRef<number | null>(null);
  const inputRef = useRef({ gasHeld, throttleLevel });

  useEffect(() => {
    layersRef.current = layers;
    inputRef.current = { gasHeld, throttleLevel };
  }, [layers, gasHeld, throttleLevel]);

  const select = (id: EnginePresetId): void => {
    // Dans le geste du joueur : c'est lui qui autorise le navigateur à jouer du son.
    if (!contextRef.current) {
      const context = new AudioContext({ latencyHint: "balanced" });
      const compressor = context.createDynamicsCompressor();
      compressor.connect(context.destination);
      contextRef.current = context;
      busRef.current = compressor;
    }
    void contextRef.current.resume();
    setPresetId((current) => (current === id ? null : id));
  };

  useEffect(() => {
    const preset = ENGINE_PRESETS.find(({ id }) => id === presetId);
    const context = contextRef.current;
    const bus = busRef.current;
    if (!preset || !context || !bus) return;
    const voice = createEngineVoice(
      context,
      bus,
      preset,
      { idleRpm, redlineRpm },
      layersRef.current,
    );
    voiceRef.current = voice;
    let frame = 0;
    let last: number | null = null;
    const tick = (time: number): void => {
      frame = requestAnimationFrame(tick);
      const dt =
        last === null ? 0 : Math.min(MAX_FRAME_S, (time - last) / 1000);
      last = time;
      const rev = (revRef.current ??= createRevState());
      const { gasHeld: held, throttleLevel: level } = inputRef.current;
      const throttle = held ? 1 : level;
      if (demoRef.current) {
        if (!demoRef.current.step(rev, dt)) {
          demoRef.current = null;
          setDemoRunning(false);
        }
      } else if (heldRpmRef.current !== null) {
        rev.rpm = heldRpmRef.current;
        rev.throttle = throttle;
      } else {
        stepRev(rev, throttle, MANUAL_GEAR, dt);
      }
      voice.update(rev.rpm, rev.throttle, dt);
      setRpm(rev.rpm);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      voice.dispose();
      voiceRef.current = null;
      demoRef.current = null;
      setDemoRunning(false);
    };
  }, [presetId]);

  // Espace : le même geste que le bouton Gaz, sans viser. Sur un bouton focalisé, il ne doit pas aussi le cliquer.
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.code !== "Space") return;
      event.preventDefault();
      setGasHeld(event.type === "keydown");
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, []);

  useEffect(
    () => () => {
      void contextRef.current?.close();
    },
    [],
  );

  return {
    presetId,
    select,
    layers,
    setLayer: (layer: EngineLayer, value: number): void => {
      setLayers((current) => ({ ...current, [layer]: value }));
      voiceRef.current?.setLayer(layer, value);
    },
    rpm,
    grabRpm: (): void => {
      heldRpmRef.current = rpm;
    },
    releaseRpm: (): void => {
      heldRpmRef.current = null;
    },
    moveRpm: (next: number): void => {
      (revRef.current ??= createRevState()).rpm = next;
      if (heldRpmRef.current !== null) heldRpmRef.current = next;
    },
    throttleLevel,
    setThrottleLevel,
    gasHeld,
    setGasHeld,
    demoRunning,
    startDemo: (): void => {
      revRef.current = createRevState();
      demoRef.current = createDemo();
      setDemoRunning(true);
    },
  };
};
