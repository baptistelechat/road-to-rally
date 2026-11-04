"use client";

import { useEffect, useState } from "react";
import {
  COPILOT_VOICES,
  createCopilotVoice,
  type CopilotVoice,
  type CopilotVoiceId,
  type VoiceBus,
} from "@/audio/copilotVoice";
import { resolveContext } from "@/audio/engineAudio";
import { callToClips, PACE_CLIPS } from "@/audio/paceNoteWords";
import type { PaceCall, PaceTurn } from "@/sim/track/paceNotes";

const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400";
const BUTTON = `rounded-lg border border-neutral-600 px-3 py-2 text-sm font-semibold transition-colors hover:border-neutral-400 ${FOCUS_RING}`;


const turn = (
  direction: PaceTurn["direction"],
  grade: PaceTurn["grade"],
  details: Partial<PaceTurn> = {},
): PaceTurn => ({
  kind: "turn",
  direction,
  grade,
  entryGrade: grade,
  startS: 0,
  endS: 0,
  long: false,
  tightens: false,
  ...details,
});

const call = (type: PaceCall["type"], notes: PaceCall["notes"]): PaceCall => ({
  type,
  notes,
  startS: 0,
  endS: 0,
});

const SAMPLE_CALLS: PaceCall[] = [
  call("single", [turn("left", 3)]),
  call("single", [turn("right", 5, { long: true })]),
  call("single", [turn("left", 2, { entryGrade: 4, tightens: true })]),
  call("single", [turn("right", 2, { entryGrade: 5, long: true, tightens: true })]),
  call("pair", [turn("left", 2), turn("right", 4)]),
  call("pair", [turn("right", 6, { long: true }), turn("left", 1)]),
  call("chain", [turn("left", 3), turn("right", 1), turn("left", 2)]),
  call("single", [{ kind: "crest", startS: 0, endS: 0 }]),
  call("single", [{ kind: "bump", startS: 0, endS: 0 }]),
  call("pair", [
    { kind: "chicane", direction: "right", startS: 0, endS: 0 },
    turn("left", 3),
  ]),
  call("pair", [turn("right", 2), { kind: "finish", startS: 0, endS: 0 }]),
];

interface LabVoice {
  voice: CopilotVoice;
  /** Dans le geste du joueur : attend que le contexte tourne, sinon le premier mot serait perdu */
  wake: () => Promise<void>;
  dispose: () => void;
}

const createLabVoice = (): LabVoice => {
  let bus: VoiceBus | null = null;
  const getBus = (): VoiceBus | null => {
    if (bus) return bus;
    const context = resolveContext();
    if (!context) return null;
    // Même compresseur en sortie que le jeu.
    const output = context.createDynamicsCompressor();
    output.connect(context.destination);
    bus = { context, output };
    return bus;
  };
  const voice = createCopilotVoice(getBus);
  return {
    voice,
    wake: async () => {
      await getBus()?.context.resume();
    },
    dispose: () => {
      voice.stop();
      void bus?.context.close();
      bus = null;
    },
  };
};

/** Voix du copilote à l'écoute : la même que le jeu, sans voiture ni piste. */
export const CopilotLab = () => {
  const [lab] = useState(createLabVoice);
  const [loaded, setLoaded] = useState(false);
  const [voice, setVoice] = useState<CopilotVoiceId>(COPILOT_VOICES[0]);

  useEffect(() => lab.dispose, [lab]);

  useEffect(() => {
    lab.voice.setVoice(voice);
    void lab.voice.load().then(() => setLoaded(true));
  }, [lab, voice]);

  const speak = (say: () => void): void => {
    void lab.wake().then(say);
  };

  return (
    <section
      aria-labelledby="copilot-lab"
      className="flex flex-col gap-4 border-t border-neutral-800 pt-6"
    >
      <h2 id="copilot-lab" className="text-xl font-bold">
        Copilote
      </h2>

      <div className="grid gap-3 sm:grid-cols-2">
        {COPILOT_VOICES.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={voice === value}
            onClick={() => setVoice(value)}
            className={`rounded-lg border px-4 py-3 text-left font-semibold transition-colors ${FOCUS_RING} ${
              voice === value
                ? "border-amber-400 bg-amber-400 text-neutral-950"
                : "border-neutral-700 bg-neutral-800 hover:border-neutral-500"
            }`}
          >
            {value}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {PACE_CLIPS.map((clip) => (
          <button
            key={clip}
            type="button"
            disabled={!loaded}
            onClick={() => speak(() => lab.voice.playClips([clip]))}
            className={`${BUTTON} disabled:opacity-40`}
          >
            {clip}
          </button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {SAMPLE_CALLS.map((sample) => {
          const text = callToClips(sample).join(" ");
          return (
            <button
              key={text}
              type="button"
              disabled={!loaded}
              onClick={() => speak(() => lab.voice.play(sample))}
              className={`${BUTTON} flex justify-between gap-3 text-left disabled:opacity-40`}
            >
              <span>{text}</span>
              {loaded && (
                <span className="tabular-nums text-neutral-400">
                  {lab.voice.durationOf(sample).toFixed(2)} s
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
};
