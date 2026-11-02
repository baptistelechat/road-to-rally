"use client";

import { useEffect, useRef, useState } from "react";
import {
  createTireVoice,
  DEFAULT_TIRE_SOUND,
  TIRE_TIMBRES,
  type TireSound,
  type TireVoice,
} from "@/audio/tireVoice";
import { RangeField } from "./RangeField";
import { demoSlip, FIELDS, percent } from "./tireFields";

/** Vitesse d'écoute en m/s : assez pour que le son ne dépende plus que du glissement. */
const SPEED = 25;
const SLIP_TC_S = 0.08;
const MAX_FRAME_S = 0.1;
const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400";

/** Crissement à l'écoute : la même voix que le jeu, sans moteur ni voiture. */
export const TireLab = () => {
  const [sound, setSound] = useState<TireSound>(DEFAULT_TIRE_SOUND);
  const [slip, setSlip] = useState(0.9);
  const [held, setHeld] = useState(false);
  const voiceRef = useRef<TireVoice | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const frameRef = useRef(0);
  const inputRef = useRef({ slip, held });
  const demoStart = useRef<number | null>(null);

  useEffect(() => {
    inputRef.current = { slip, held };
    voiceRef.current?.setSound(sound);
  }, [slip, held, sound]);

  useEffect(
    () => () => {
      cancelAnimationFrame(frameRef.current);
      voiceRef.current?.dispose();
      void contextRef.current?.close();
    },
    [],
  );

  // Dans le geste du joueur : c'est lui qui autorise le navigateur à jouer du son.
  const wake = (): void => {
    if (contextRef.current) {
      void contextRef.current.resume();
      return;
    }
    const context = new AudioContext({ latencyHint: "balanced" });
    const compressor = context.createDynamicsCompressor();
    compressor.connect(context.destination);
    const voice = createTireVoice(
      context,
      compressor,
      (param, value, timeConstant) =>
        param.setTargetAtTime(value, context.currentTime, timeConstant),
      sound,
    );
    contextRef.current = context;
    voiceRef.current = voice;
    let current = 0;
    let last: number | null = null;
    const tick = (time: number): void => {
      frameRef.current = requestAnimationFrame(tick);
      const dt =
        last === null ? 0 : Math.min(MAX_FRAME_S, (time - last) / 1000);
      last = time;
      const input = inputRef.current;
      const demo =
        demoStart.current === null
          ? 0
          : demoSlip((time - demoStart.current) / 1000, input.slip);
      const target = input.held ? input.slip : demo;
      current += (target - current) * (1 - Math.exp(-dt / SLIP_TC_S));
      voice.update(current, SPEED);
    };
    frameRef.current = requestAnimationFrame(tick);
  };

  return (
    <section
      aria-labelledby="tire-lab"
      className="flex flex-col gap-4 border-t border-neutral-800 pt-6"
    >
      <h2 id="tire-lab" className="text-xl font-bold">
        Crissement
      </h2>

      <div className="grid gap-3 sm:grid-cols-3">
        {TIRE_TIMBRES.map(({ label, sound: timbre }) => (
          <button
            key={label}
            type="button"
            aria-pressed={sound === timbre}
            onClick={() => setSound(timbre)}
            className={`rounded-lg border px-4 py-3 text-left font-semibold transition-colors ${FOCUS_RING} ${
              sound === timbre
                ? "border-amber-400 bg-amber-400 text-neutral-950"
                : "border-neutral-700 bg-neutral-800 hover:border-neutral-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <button
          type="button"
          aria-pressed={held}
          onPointerDown={() => {
            wake();
            setHeld(true);
          }}
          onPointerUp={() => setHeld(false)}
          onPointerLeave={() => setHeld(false)}
          className={`touch-none rounded-lg px-8 py-4 text-lg font-bold transition-colors ${FOCUS_RING} ${
            held ? "bg-red-500 text-white" : "bg-neutral-100 text-neutral-950"
          }`}
        >
          Déraper
        </button>
        <button
          type="button"
          onClick={() => {
            wake();
            demoStart.current = performance.now();
          }}
          className={`rounded-lg border border-neutral-600 px-8 py-4 font-semibold transition-colors hover:border-neutral-400 ${FOCUS_RING}`}
        >
          Démo
        </button>
        <RangeField
          id="tire-slip"
          label="Glissement"
          readout={percent(slip)}
          max={1}
          step={0.01}
          value={slip}
          onChange={setSlip}
        />
      </div>

      <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {FIELDS.map(({ key, label, min, max, step, readout }) => (
          <RangeField
            key={key}
            id={`tire-${key}`}
            label={label}
            readout={readout(sound[key])}
            min={min}
            max={max}
            step={step}
            value={sound[key]}
            onChange={(value) => setSound({ ...sound, [key]: value })}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() =>
          void navigator.clipboard.writeText(JSON.stringify(sound))
        }
        className={`self-start rounded-lg border border-neutral-600 px-4 py-2 text-sm font-semibold transition-colors hover:border-neutral-400 ${FOCUS_RING}`}
      >
        Copier les réglages
      </button>
    </section>
  );
};
