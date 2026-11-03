"use client";

import { ENGINE_PRESETS } from "@/audio/enginePresets";
import type { EngineLayer } from "@/audio/engineVoice";
import { carConfig } from "@/sim/carConfig";
import { CopilotLab } from "./CopilotLab";
import { RangeField } from "./RangeField";
import { TireLab } from "./TireLab";
import { useSoundLab } from "./useSoundLab";

const { idleRpm, redlineRpm } = carConfig.engine;

const LAYER_LABELS: Record<EngineLayer, string> = {
  saturation: "Saturation",
  exhaust: "Résonance d'échappement",
  intake: "Admission",
  mechanical: "Mécanique",
  overrun: "Frein moteur",
  pops: "Pétarades",
  turbo: "Turbo",
};
const LAYERS = Object.keys(LAYER_LABELS) as EngineLayer[];
const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400";

export const SoundLab = () => {
  const lab = useSoundLab();
  const { presetId, layers, rpm, throttleLevel, gasHeld, demoRunning } = lab;
  const locked = presetId === null || demoRunning;
  const hasTurbo = ENGINE_PRESETS.find(({ id }) => id === presetId)?.turbo;
  const revShare = (rpm - idleRpm) / (redlineRpm - idleRpm);

  return (
    <main className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
        <h1 className="text-2xl font-bold">Labo son</h1>

        <div className="grid gap-3 sm:grid-cols-3">
          {ENGINE_PRESETS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              aria-pressed={presetId === id}
              onClick={() => lab.select(id)}
              className={`rounded-lg border px-4 py-5 text-left font-semibold transition-colors ${FOCUS_RING} ${
                presetId === id
                  ? "border-amber-400 bg-amber-400 text-neutral-950"
                  : "border-neutral-700 bg-neutral-800 hover:border-neutral-500"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <RangeField
          id="rpm"
          label="Régime"
          readout={`${Math.round(rpm)} tr/min`}
          min={idleRpm}
          max={redlineRpm}
          step={10}
          value={rpm}
          disabled={locked}
          danger={revShare > 0.9}
          onChange={lab.moveRpm}
          onPointerDown={lab.grabRpm}
          onPointerUp={lab.releaseRpm}
        />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <button
            type="button"
            disabled={locked}
            aria-pressed={gasHeld}
            onPointerDown={() => lab.setGasHeld(true)}
            onPointerUp={() => lab.setGasHeld(false)}
            onPointerLeave={() => lab.setGasHeld(false)}
            className={`touch-none rounded-lg px-8 py-4 text-lg font-bold transition-colors disabled:opacity-40 ${FOCUS_RING} ${
              gasHeld
                ? "bg-red-500 text-white"
                : "bg-neutral-100 text-neutral-950"
            }`}
          >
            Gaz
          </button>
          <button
            type="button"
            disabled={locked}
            onClick={lab.startDemo}
            className={`rounded-lg border border-neutral-600 px-8 py-4 font-semibold transition-colors hover:border-neutral-400 disabled:opacity-40 ${FOCUS_RING}`}
          >
            Démo
          </button>
          <RangeField
            id="throttle"
            label="Charge"
            readout={`${Math.round(throttleLevel * 100)} %`}
            max={1}
            step={0.01}
            value={throttleLevel}
            disabled={locked}
            onChange={lab.setThrottleLevel}
          />
        </div>

        <div className="grid gap-x-8 gap-y-4 border-t border-neutral-800 pt-6 sm:grid-cols-2">
          {LAYERS.filter((layer) => layer !== "turbo" || hasTurbo).map(
            (layer) => (
              <RangeField
                key={layer}
                id={layer}
                label={LAYER_LABELS[layer]}
                readout={`${Math.round(layers[layer] * 100)} %`}
                max={2}
                step={0.05}
                value={layers[layer]}
                onChange={(value) => lab.setLayer(layer, value)}
              />
            ),
          )}
        </div>

        <TireLab />
        <CopilotLab />
      </div>
    </main>
  );
};
