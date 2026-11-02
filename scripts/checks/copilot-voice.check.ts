import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createCopilotVoice, SPEECH_RATES } from "../../src/audio/copilotVoice";
import { callToWords, PACE_WORDS } from "../../src/audio/paceNoteWords";
import { createNotesBenchStage } from "../../src/sim/track/notesBenchTrack";
import {
  computePaceNotes,
  type PaceCall,
  type PaceNote,
  type PaceTurn,
} from "../../src/sim/track/paceNotes";
import { createSandboxTrack } from "../../src/sim/track/sandboxTrack";
import { createStageTrack } from "../../src/sim/track/stage";
import { parseStage } from "../../src/sim/track/stageCodec";

const turn = (
  direction: PaceTurn["direction"],
  grade: PaceTurn["grade"],
  details: Partial<PaceTurn> = {},
): PaceTurn => ({
  kind: "turn",
  direction,
  grade,
  startS: 0,
  endS: 1,
  long: false,
  tightens: false,
  ...details,
});

const call = (type: PaceCall["type"], notes: PaceNote[]): PaceCall => ({
  type,
  notes,
  startS: 0,
  endS: 1,
});

const checkWords = (): void => {
  const detailed = call("single", [
    turn("left", 3, { long: true, tightens: true }),
  ]);
  assert.deepEqual(callToWords(detailed), [
    "gauche",
    "trois",
    "longue",
    "se-resserre",
  ]);
  assert.deepEqual(callToWords(detailed, { short: true }), ["gauche", "trois"]);
  assert.deepEqual(
    callToWords(
      call("pair", [turn("right", 2), turn("left", 6, { long: true })]),
    ),
    ["droite", "deux", "puis", "gauche", "six", "longue"],
  );
  assert.deepEqual(
    callToWords(
      call("chain", [
        turn("right", 3, { long: true }),
        turn("left", 1),
        turn("right", 2),
      ]),
    ),
    ["enfilade", "droite", "un"],
  );
  assert.deepEqual(
    callToWords(call("single", [{ kind: "crest", startS: 0, endS: 1 }])),
    ["attention", "crete"],
  );
  assert.deepEqual(
    callToWords(call("single", [{ kind: "bump", startS: 0, endS: 1 }]), {
      short: true,
    }),
    ["attention", "bosse"],
  );
};

const checkTracks = (): void => {
  const stageFile = (name: string) =>
    createStageTrack(
      parseStage(
        JSON.parse(readFileSync(`public/stages/${name}.json`, "utf8")),
      ),
    );
  const tracks = {
    track: createSandboxTrack(),
    road: stageFile("road"),
    mountain: stageFile("mountain"),
    notes: createStageTrack(createNotesBenchStage()),
  };
  for (const [name, track] of Object.entries(tracks)) {
    const { calls } = computePaceNotes(track);
    assert.ok(calls.length > 0, `${name} : aucune annonce`);
    for (const paceCall of calls)
      for (const options of [{}, { short: true }])
        for (const word of callToWords(paceCall, options))
          assert.ok(
            existsSync(`public/audio/copilot/${word}.wav`),
            `${name} : « ${word} » n'a pas de fichier`,
          );
  }
};

/** Lit le WAV sans décodeur : PCM 16 bits mono, avec du son dedans. */
const checkWav = (word: string): void => {
  const file = readFileSync(`public/audio/copilot/${word}.wav`);
  assert.equal(file.toString("latin1", 0, 4), "RIFF", `${word} : pas un WAV`);
  assert.equal(file.toString("latin1", 8, 12), "WAVE", `${word} : pas un WAV`);
  let channels = 0;
  let bits = 0;
  let peak = 0;
  let samples = 0;
  for (let at = 12; at + 8 <= file.length;) {
    const id = file.toString("latin1", at, at + 4);
    const size = file.readUInt32LE(at + 4);
    if (id === "fmt ") {
      assert.equal(file.readUInt16LE(at + 8), 1, `${word} : pas du PCM`);
      channels = file.readUInt16LE(at + 10);
      bits = file.readUInt16LE(at + 22);
    }
    if (id === "data") {
      samples = size / 2;
      for (let i = 0; i < samples; i++)
        peak = Math.max(peak, Math.abs(file.readInt16LE(at + 8 + i * 2)));
    }
    at += 8 + size + (size % 2);
  }
  assert.equal(channels, 1, `${word} : pas en mono`);
  assert.equal(bits, 16, `${word} : pas en 16 bits`);
  assert.ok(samples > 0, `${word} : aucun échantillon`);
  assert.ok(peak > 0, `${word} : silence`);
};

/** Dans Node, ni `fetch` relatif ni décodeur : c'est le cas du fichier manquant. */
const checkMissingFiles = async (): Promise<void> => {
  const errors: unknown[] = [];
  const { error: logError } = console;
  console.error = (...args: unknown[]) => errors.push(args);
  const voice = createCopilotVoice(() => null);
  await voice.load();
  console.error = logError;
  assert.equal(
    errors.length,
    PACE_WORDS.length,
    "erreurs de chargement muettes",
  );

  const phrase = call("pair", [turn("left", 2), turn("right", 4)]);
  const normal = voice.durationOf(phrase);
  assert.ok(Number.isFinite(normal) && normal > 0, "durée de repli invalide");
  voice.setRate(SPEECH_RATES.rapide);
  assert.ok(voice.durationOf(phrase) < normal, "la vitesse change la durée");
  voice.setRate(10);
  assert.equal(
    voice.durationOf(phrase),
    (normal * SPEECH_RATES.normal) / SPEECH_RATES.rapide,
    "vitesse hors plage",
  );
  voice.play(phrase);
  assert.equal(voice.isSpeaking(), false, "parle sans contexte");
  voice.stop();
};

export default async function check(): Promise<void> {
  checkWords();
  checkTracks();
  for (const word of PACE_WORDS) checkWav(word);
  await checkMissingFiles();
}
