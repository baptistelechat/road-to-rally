import assert from "node:assert/strict";
import { createCopilotVoice } from "../../src/audio/copilotVoice";
import {
  applyAudioOptions,
  type CopilotOptions,
  defaultCopilotOptions,
  loadCopilotOptions,
  parseCopilotOptions,
  saveCopilotOptions,
  type SpeechRate,
} from "../../src/game/copilotOptions";
import { menuCancelTarget } from "../../src/game/Hud/applyMenuAction";
import { setCopilotOptions, useHudStore } from "../../src/game/hudStore";
import { createPaceNoteCue } from "../../src/sim/paceNoteCue";
import { createNotesBenchStage } from "../../src/sim/track/notesBenchTrack";
import { computePaceNotes } from "../../src/sim/track/paceNotes";
import { createStageTrack } from "../../src/sim/track/stage";

const CHANGED: CopilotOptions = {
  voiceEnabled: false,
  speechRate: "rapide",
  voiceVolume: 30,
  engineVolume: 70,
  effectsVolume: 0,
  paceIconsEnabled: false,
  miniMapEnabled: false,
  miniMapStyle: "hybrid",
};

/** Remplace `localStorage` le temps de `run`. */
const withStorage = (storage: unknown, run: () => void): void => {
  const before = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
  });
  try {
    run();
  } finally {
    if (before) Object.defineProperty(globalThis, "localStorage", before);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
};

const checkUnreadable = (): void => {
  for (const raw of [null, "", "{", "null", "5", '"x"', "[]"])
    assert.deepEqual(
      parseCopilotOptions(raw),
      defaultCopilotOptions,
      raw ?? "",
    );
  assert.deepEqual(
    parseCopilotOptions(
      JSON.stringify({
        voiceEnabled: "non",
        speechRate: "toString",
        voiceVolume: 33,
        engineVolume: "100",
        effectsVolume: 101,
        paceIconsEnabled: 0,
        miniMapEnabled: null,
        miniMapStyle: "rotation",
      }),
    ),
    defaultCopilotOptions,
    "valeurs de mauvais type",
  );
  assert.deepEqual(
    parseCopilotOptions('{"voiceVolume":0,"speechRate":"lent","x":1}'),
    { ...defaultCopilotOptions, voiceVolume: 0, speechRate: "lent" },
    "les valeurs valides restent, 0 % compris",
  );
};

const checkBlocked = (): void => {
  const blocked = {
    getItem: () => {
      throw new Error("bloqué");
    },
    setItem: () => {
      throw new Error("bloqué");
    },
  };
  withStorage(blocked, () => {
    assert.deepEqual(loadCopilotOptions(), defaultCopilotOptions);
    assert.doesNotThrow(() => saveCopilotOptions(CHANGED));
  });
  withStorage(undefined, () => {
    assert.deepEqual(loadCopilotOptions(), defaultCopilotOptions);
    assert.doesNotThrow(() => saveCopilotOptions(CHANGED));
  });
};

const checkRoundTrip = (): void => {
  const stored = new Map<string, string>();
  let writes = 0;
  const storage = {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => {
      writes++;
      stored.set(key, value);
    },
  };
  withStorage(storage, () => {
    assert.deepEqual(loadCopilotOptions(), defaultCopilotOptions);
    assert.equal(writes, 0, "charger n'écrit pas dans le stockage");
    saveCopilotOptions(CHANGED);
    assert.deepEqual(loadCopilotOptions(), CHANGED);
    const before = useHudStore.getState().copilotOptions;
    setCopilotOptions(defaultCopilotOptions);
    assert.equal(writes, 2, "un choix du joueur écrit");
    assert.deepEqual(loadCopilotOptions(), defaultCopilotOptions);
    useHudStore.setState({ copilotOptions: before });
  });
};

const checkCancel = (): void => {
  assert.equal(menuCancelTarget(true, true, "pause"), "list");
  assert.equal(menuCancelTarget(false, true, "pause"), "back", "panneau");
  assert.equal(menuCancelTarget(false, true, "start"), "back", "panneau");
  assert.equal(menuCancelTarget(false, false, "pause"), "race");
  assert.equal(menuCancelTarget(false, false, "start"), null);
};

const DT = 1 / 60;
const SPEED = 15;

/** Toutes les annonces d'une spéciale à vitesse constante, avec l'abscisse de la fin de chaque phrase. */
const driveCues = (speechRate: SpeechRate) => {
  const track = createStageTrack(createNotesBenchStage());
  const voice = createCopilotVoice(() => null);
  applyAudioOptions(
    { voice, setVoiceEnabled: () => undefined, setMix: () => undefined },
    { ...defaultCopilotOptions, speechRate },
  );
  const cue = createPaceNoteCue(track, computePaceNotes(track).calls, {
    durationOf: (call, short) => voice.durationOf(call, { short }),
  });
  const cues = [];
  let s = track.startS;
  for (let now = 0; s < track.finishS; now += DT, s += SPEED * DT) {
    const { x, z } = track.points[track.indexAt(s)];
    const next = cue.update({
      x,
      z,
      speed: SPEED,
      now,
      respawnCount: 0,
      finished: false,
    });
    if (next)
      cues.push({
        index: next.index,
        startS: next.call.startS,
        firedAt: s,
        endsAt: s + SPEED * voice.durationOf(next.call, { short: next.short }),
      });
  }
  return cues;
};

const checkRateMovesCues = (): void => {
  const slow = driveCues("lent");
  const fast = driveCues("rapide");
  assert.ok(slow.length > 0);
  for (const cues of [slow, fast])
    for (const { startS, endsAt } of cues)
      assert.ok(endsAt <= startS, `phrase finie après le virage (${startS})`);
  const earlier = slow.filter((cue) =>
    fast.some(
      ({ index, firedAt }) => index === cue.index && cue.firedAt < firedAt,
    ),
  );
  assert.ok(earlier.length > 0, "plus lent : annonce plus tôt");
};

const checkMix = (): void => {
  const mixes: number[][] = [];
  applyAudioOptions(
    {
      voice: createCopilotVoice(() => null),
      setVoiceEnabled: () => undefined,
      setMix: (engine, effects) => mixes.push([engine, effects]),
    },
    CHANGED,
  );
  assert.deepEqual(mixes, [[0.7, 0]], "balance moteur et effets en 0 à 1");
};

export default async function check(): Promise<void> {
  checkUnreadable();
  checkBlocked();
  checkRoundTrip();
  checkCancel();
  checkRateMovesCues();
  checkMix();
}
