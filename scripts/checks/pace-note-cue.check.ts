import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SPEECH_RATES } from "../../src/audio/copilotVoice";
import { callToWords } from "../../src/audio/paceNoteWords";
import { botInput } from "../../src/sim/bot";
import { FIXED_DT } from "../../src/sim/fixedStep";
import {
  createPaceNoteCue,
  type CueTiming,
  type PaceCue,
  type PaceNoteCue,
} from "../../src/sim/paceNoteCue";
import { initRapier } from "../../src/sim/rapier";
import { createSimulation } from "../../src/sim/simulation";
import { createTrack } from "../../src/sim/track/createTrack";
import { createNotesBenchStage } from "../../src/sim/track/notesBenchTrack";
import { computePaceNotes, type PaceCall } from "../../src/sim/track/paceNotes";
import { createSandboxTrack } from "../../src/sim/track/sandboxTrack";
import { signedCurvature } from "../../src/sim/track/scenery";
import { createStageTrack } from "../../src/sim/track/stage";
import { parseStage } from "../../src/sim/track/stageCodec";
import type { StageData, Track } from "../../src/sim/types";

/** Écart entre deux mots, comme dans `copilotVoice.ts` */
const WORD_GAP_S = 0.03;
/** Constantes du bot, pour le parcours cinématique */
const LATERAL_ACCEL = 6;
const OPEN_LATERAL_ACCEL = 4.5;
const BRAKING_DECEL = 5;
const MIN_SPEED = 8;
const OPEN_MIN_SPEED = 6;
const MAX_SPEED = 45;
const ACCEL = 4;
/** Les premières annonces peuvent être trop près du départ pour finir à l'heure, en mètres */
const NEAR_START = 150;
/** Écart maximal entre deux phrases enchaînées, en secondes : deux pas de simulation */
const CHAIN_TOLERANCE = 2 * FIXED_DT;

const wordCache = new Map<string, number>();

/** Durée réelle du fichier d'un mot : en-tête WAV de 44 octets, PCM mono 16 bits. */
const wordSeconds = (word: string): number => {
  const known = wordCache.get(word);
  if (known !== undefined) return known;
  const file = readFileSync(`public/audio/copilot/${word}.wav`);
  const seconds = (file.length - 44) / 2 / file.readUInt32LE(24);
  wordCache.set(word, seconds);
  return seconds;
};

/** Vitesse de diction du contrôle en cours */
let speechRate: number = SPEECH_RATES.normal;

/** La durée réelle des phrases, avec les vrais mots */
const durationOf: CueTiming["durationOf"] = (call, short) => {
  const words = callToWords(call, { short });
  const spoken = words.reduce((sum, word) => sum + wordSeconds(word), 0);
  return (spoken + (words.length - 1) * WORD_GAP_S) / speechRate;
};
const timing: CueTiming = { durationOf };

interface Said {
  index: number;
  short: boolean;
  start: number;
  end: number;
}

interface Measure {
  said: number;
  total: number;
  shortened: number;
  late: number;
  minLead: number;
  maxLead: number;
}

/** Vitesse visée en chaque point de l'axe, freinage anticipé compris, en m/s */
const speedProfile = (track: Track): number[] => {
  const { points, closed } = track;
  const n = points.length;
  const curvature = signedCurvature(track);
  const lateral = closed ? LATERAL_ACCEL : OPEN_LATERAL_ACCEL;
  const floor = closed ? MIN_SPEED : OPEN_MIN_SPEED;
  const speeds = curvature.map((k) =>
    Math.max(
      floor,
      Math.min(MAX_SPEED, Math.sqrt(lateral / Math.max(Math.abs(k), 1e-6))),
    ),
  );
  for (let i = 2 * n - 1; i >= 0; i--) {
    const here = i % n;
    if (!closed && i >= n - 1) continue;
    const after = (here + 1) % n;
    const ds = Math.hypot(
      points[after].x - points[here].x,
      points[after].z - points[here].z,
    );
    speeds[here] = Math.min(
      speeds[here],
      Math.sqrt(speeds[after] ** 2 + 2 * BRAKING_DECEL * ds),
    );
  }
  return speeds;
};

interface Drive {
  track: Track;
  profile: number[];
  pace: number;
  s: number;
  speed: number;
  now: number;
}

const startDrive = (track: Track, pace: number): Drive => ({
  track,
  profile: speedProfile(track),
  pace,
  s: track.startS,
  speed: 0,
  now: 0,
});

const pointAt = (track: Track, s: number): { x: number; z: number } => {
  const i = track.indexAt(track.closed ? s % track.length : s);
  return track.points[i];
};

/** Un pas de conduite vers l'avant, à l'allure tirée des rayons. */
const advance = (drive: Drive): void => {
  const { track, profile, pace } = drive;
  const target =
    profile[track.indexAt(track.closed ? drive.s % track.length : drive.s)] *
    pace;
  drive.speed = Math.min(target, drive.speed + ACCEL * pace * FIXED_DT);
  drive.s += Math.max(drive.speed, 1) * FIXED_DT;
  drive.now += FIXED_DT;
};

const feed = (
  cue: PaceNoteCue,
  drive: Drive,
  respawnCount = 0,
  finished = false,
): PaceCue | null => {
  const { x, z } = pointAt(drive.track, drive.s);
  return cue.update({
    x,
    z,
    speed: drive.speed,
    now: drive.now,
    respawnCount,
    finished,
  });
};

const toSaid = (cue: PaceCue, now: number): Said => ({
  index: cue.index,
  short: cue.short,
  start: now,
  end: now + durationOf(cue.call, cue.short),
});

/** Contrôle commun : `crossing[k]` est le temps où la voiture atteint le début de l'annonce k. */
const measure = (
  name: string,
  calls: PaceCall[],
  said: Said[],
  crossing: number[],
  track: Track,
): Measure => {
  assert.equal(
    said.length >= calls.length,
    true,
    `${name} : annonces manquantes (${said.length}/${calls.length})`,
  );
  let minLead = Infinity;
  let maxLead = 0;
  let late = 0;
  let shortened = 0;
  said.slice(0, calls.length).forEach((item, k) => {
    assert.equal(item.index, k, `${name} : annonce ${k} dans le désordre`);
    if (k > 0)
      assert.ok(
        item.start >= said[k - 1].end - 1e-9,
        `${name} : phrase ${k} coupe la précédente`,
      );
    if (item.short) shortened++;
    const lead = crossing[k] - item.end;
    minLead = Math.min(minLead, lead);
    maxLead = Math.max(maxLead, lead);
    if (lead > 0) return;
    late++;
    const nearStart = calls[k].startS - track.startS < NEAR_START;
    // Phrases enchaînées sans pause depuis le départ : aucun planning ne peut les avancer sans en sauter une.
    const chained = said
      .slice(1, k + 1)
      .every((next, i) => next.start - said[i].end < CHAIN_TOLERANCE);
    assert.ok(
      chained && nearStart,
      `${name} : annonce ${k} finie ${(-lead).toFixed(2)} s après le début de son virage, en s=${calls[k].startS.toFixed(0)}`,
    );
  });
  return {
    said: Math.min(said.length, calls.length),
    total: calls.length,
    shortened,
    late,
    minLead,
    maxLead,
  };
};

const report = (name: string, mode: string, m: Measure): void => {
  console.log(
    `     ${name} ${mode} : ${m.said}/${m.total} annonces, ${m.shortened} raccourcies, ${m.late} en retard, avance de ${m.minLead.toFixed(2)} à ${m.maxLead.toFixed(1)} s`,
  );
};

/** Parcours cinématique à allure donnée. Un tracé fermé tourne deux fois : la première annonce repart à chaque tour. */
const runKinematic = (
  name: string,
  track: Track,
  calls: PaceCall[],
  pace: number,
): { said: Said[]; result: Measure } => {
  const drive = startDrive(track, pace);
  const cue = createPaceNoteCue(track, calls, timing);
  const said: Said[] = [];
  const crossing: number[] = [];
  const laps = track.closed ? 2 : 1;
  const end = track.closed ? laps * track.length : track.finishS;
  const startOf = (k: number): number =>
    Math.floor(k / calls.length) * track.length +
    calls[k % calls.length].startS;
  while (drive.s < end) {
    const out = feed(cue, drive);
    if (out) said.push(toSaid(out, drive.now));
    while (
      crossing.length < laps * calls.length &&
      drive.s >= startOf(crossing.length)
    )
      crossing.push(drive.now);
    advance(drive);
  }
  const lapCalls = Array.from({ length: laps }, () => calls).flat();
  if (track.closed) {
    assert.deepEqual(
      said.map((item) => item.index),
      lapCalls.map((_, k) => k % calls.length),
      `${name} : séquence des annonces sur deux tours`,
    );
  }
  const result = measure(
    name,
    lapCalls,
    said.map((item, k) => ({ ...item, index: k })),
    crossing,
    track,
  );
  return { said, result: { ...result, total: lapCalls.length } };
};

/** À la simulation réelle : le bot parcourt la piste jusqu'à l'arrivée, ou un tour de circuit. */
const runBot = (name: string, stage: StageData | undefined): void => {
  const sim = createSimulation(undefined, stage);
  const { track } = sim;
  const { calls } = computePaceNotes(track);
  const cue = createPaceNoteCue(track, calls, timing);
  const said: Said[] = [];
  const crossing: number[] = [];
  let s = track.nearest(sim.state().position.x, sim.state().position.z).s;
  let done = false;
  for (let i = 0; i < 60 * 900 && !done; i++) {
    const lapMs = sim.step(botInput(sim.state(), track));
    const state = sim.state();
    const { x, z } = state.position;
    const now = (i + 1) * FIXED_DT;
    const finished = sim.lap.finished();
    const out = cue.update({
      x,
      z,
      speed: state.speed,
      now,
      respawnCount: sim.respawnCount(),
      finished,
    });
    if (out) said.push(toSaid(out, now));
    if (finished) assert.equal(out, null, `${name} : annonce après l'arrivée`);
    const raw = track.nearest(x, z).s;
    let gap = raw - s;
    if (track.closed) gap -= Math.round(gap / track.length) * track.length;
    if (Math.abs(gap) <= 25) s += gap;
    while (crossing.length < calls.length && s >= calls[crossing.length].startS)
      crossing.push(now);
    done = lapMs !== null;
  }
  assert.ok(done, `${name} : arrivée non atteinte`);
  assert.equal(sim.respawnCount(), 0, `${name} : remise en piste`);
  report(name, "bot réel", measure(name, calls, said, crossing, track));
  sim.free();
};

const checkReverse = (track: Track, calls: PaceCall[]): void => {
  const drive = startDrive(track, 1);
  const cue = createPaceNoteCue(track, calls, timing);
  const indices: number[] = [];
  const step = (): void => {
    const out = feed(cue, drive);
    if (out) indices.push(out.index);
  };
  while (indices.length < 5) {
    step();
    advance(drive);
  }
  const atReverse = indices.length;
  drive.now += 5;
  const back = drive.s - 60;
  while (drive.s > back) {
    drive.s -= 10 * FIXED_DT;
    drive.speed = 10;
    drive.now += FIXED_DT;
    step();
  }
  assert.equal(indices.length, atReverse, "annonce en marche arrière");
  // À l'arrêt, plus loin que le recul toléré : rien non plus.
  drive.speed = 0;
  for (let i = 0; i < 300; i++) {
    drive.now += FIXED_DT;
    step();
  }
  assert.equal(indices.length, atReverse, "annonce à l'arrêt après un recul");
  while (drive.s < track.finishS) {
    step();
    advance(drive);
  }
  assert.deepEqual(
    indices,
    calls.map((_, k) => k),
    "répétition ou saut après une marche arrière",
  );
};

const checkRespawn = (track: Track, calls: PaceCall[]): void => {
  const drive = startDrive(track, 1);
  const cue = createPaceNoteCue(track, calls, timing);
  feed(cue, drive);
  const firstAhead = (s: number): number =>
    calls.findIndex((call) => call.startS > s);
  for (const [respawn, to] of [
    [1, track.startS + 0.6 * (track.finishS - track.startS)],
    [2, track.startS + 0.2 * (track.finishS - track.startS)],
  ]) {
    drive.s = to;
    drive.speed = 0;
    drive.now += 5;
    const ahead = firstAhead(to);
    let out = feed(cue, drive, respawn);
    while (out === null) {
      advance(drive);
      out = feed(cue, drive, respawn);
    }
    assert.equal(out.index, ahead, "annonce après remise en piste");
  }
  // Redémarrage : repart de la première annonce.
  cue.reset();
  drive.s = track.startS;
  drive.speed = 0;
  drive.now += 5;
  let out = feed(cue, drive, 2);
  while (out === null) {
    advance(drive);
    out = feed(cue, drive, 2);
  }
  assert.equal(out.index, 0, "annonce après redémarrage");
};

/** Remise en piste juste avant un virage à précisions : trop tard pour la phrase entière. */
const checkShort = (track: Track, calls: PaceCall[]): void => {
  const detailed = calls.findIndex((call) =>
    call.notes.some(
      (note) => note.kind === "turn" && (note.long || note.tightens),
    ),
  );
  assert.ok(detailed >= 0, "aucun virage à précisions");
  const drive = startDrive(track, 1);
  const cue = createPaceNoteCue(track, calls, timing);
  feed(cue, drive);
  drive.s = calls[detailed].startS - 15;
  drive.speed = 20;
  drive.now += 5;
  const late = feed(cue, drive, 1);
  assert.equal(late?.index, detailed);
  assert.equal(late?.short, true, "phrase en retard non raccourcie");

  // Même retard sur une annonce sans précision : rien à raccourcir.
  const plain = calls.findIndex(
    (call, k) =>
      k > detailed && durationOf(call, true) === durationOf(call, false),
  );
  drive.s = calls[plain].startS - 15;
  drive.now += 5;
  const out = feed(cue, drive, 2);
  assert.equal(out?.index, plain);
  assert.equal(out?.short, false, "phrase sans précision raccourcie");

  // En roulant à l'heure, la même annonce garde ses précisions.
  const onTime = createPaceNoteCue(track, calls, timing);
  drive.speed = 20;
  let said: PaceCue | null = null;
  for (
    drive.s = calls[detailed].startS - 400;
    drive.s < calls[detailed].startS && said?.index !== detailed;
    drive.s += 1
  ) {
    drive.now += 5;
    said = feed(onTime, drive) ?? said;
  }
  assert.equal(said?.index, detailed, "annonce à précisions non faite");
  assert.equal(said?.short, false, "phrase à l'heure raccourcie");
};

const checkFinished = (track: Track, calls: PaceCall[]): void => {
  const drive = startDrive(track, 1);
  const cue = createPaceNoteCue(track, calls, timing);
  let said = 0;
  while (said < 2) {
    if (feed(cue, drive)) said++;
    advance(drive);
  }
  for (let i = 0; i < 2000 && drive.s < track.finishS; i++) {
    assert.equal(feed(cue, drive, 0, true), null, "annonce après l'arrivée");
    assert.equal(cue.activeCalls().length, 0, "icône après l'arrivée");
    advance(drive);
  }
};

/** Deux points d'une même épingle : proches à plat, loin sur la route. */
const findHairpin = (track: Track, calls: PaceCall[]): [number, number] => {
  const sOf = (i: number): number =>
    track.nearest(track.points[i].x, track.points[i].z).s;
  for (const call of calls) {
    const from = track.indexAt(Math.max(track.startS, call.startS - 40));
    for (let j = track.indexAt(call.endS) + 1; j < track.points.length; j++) {
      const a = track.points[from];
      const b = track.points[j];
      const span = call.endS + (j - track.indexAt(call.endS)) * 2 - call.startS;
      if (span > 200) break;
      if (Math.hypot(a.x - b.x, a.z - b.z) < 25 && sOf(j) - sOf(from) > 60)
        return [sOf(from), sOf(j)];
    }
  }
  throw new Error("épingle introuvable");
};

const checkBranchJump = (track: Track, calls: PaceCall[]): void => {
  const [near, far] = findHairpin(track, calls);
  const run = (flicker: boolean): number[] => {
    const drive = startDrive(track, 1);
    const cue = createPaceNoteCue(track, calls, timing);
    const indices: number[] = [];
    let flickers = flicker ? 30 : 0;
    while (drive.s < track.finishS) {
      if (drive.s > near - 20 && flickers > 0) {
        flickers--;
        const { x, z } = pointAt(track, far);
        const out = cue.update({
          x,
          z,
          speed: drive.speed,
          now: drive.now,
          respawnCount: 0,
          finished: false,
        });
        if (out) indices.push(out.index);
      } else {
        const out = feed(cue, drive);
        if (out) indices.push(out.index);
      }
      advance(drive);
    }
    return indices;
  };
  const baseline = run(false);
  assert.deepEqual(
    baseline,
    calls.map((_, k) => k),
  );
  assert.deepEqual(
    run(true),
    baseline,
    "saut de branche pris pour une progression",
  );

  // Vraie coupe : la voiture roule sur la branche suivante, les virages coupés ne sont pas annoncés.
  const drive = startDrive(track, 1);
  const cue = createPaceNoteCue(track, calls, timing);
  const indices: number[] = [];
  while (drive.s < near) {
    const out = feed(cue, drive);
    if (out) indices.push(out.index);
    advance(drive);
  }
  drive.s = far;
  while (drive.s < track.finishS) {
    const out = feed(cue, drive);
    if (out) {
      indices.push(out.index);
      assert.ok(out.call.endS >= near, "virage coupé annoncé");
    }
    advance(drive);
  }
  assert.ok(
    indices.every((v, i) => i === 0 || v > indices[i - 1]),
    "répétition après une coupe",
  );
  const after = calls.findIndex((call) => call.startS > far + 100);
  assert.ok(indices.includes(after), "annonces perdues après une coupe");
};

const checkReplay = (track: Track, calls: PaceCall[]): void => {
  const drive = startDrive(track, 1);
  const cue = createPaceNoteCue(track, calls, timing);
  let out = feed(cue, drive);
  while (out === null || out.index === 0) {
    advance(drive);
    out = feed(cue, drive);
  }
  const { index } = out;
  assert.ok(
    cue.activeCalls().some((item) => item.index === index),
    "annonce absente des icônes",
  );
  // Pause en pleine phrase : `now` figé. Elle est redite, et rien ne part avant sa fin.
  const replayed = cue.replay(drive.now);
  assert.equal(replayed?.index, index, "phrase non redite");
  const until = drive.now + durationOf(out.call, out.short);
  while (drive.now < until - FIXED_DT) {
    advance(drive);
    assert.equal(feed(cue, drive), null, "phrase redite coupée");
  }
  assert.equal(cue.replay(until + 1), null, "phrase finie redite");
  while (drive.s <= calls[index].endS + 1) {
    advance(drive);
    feed(cue, drive);
  }
  assert.ok(
    !cue.activeCalls().some((item) => item.index === index),
    "icône d'un virage dépassé",
  );
};

/** Une icône par virage : dans une annonce groupée, chaque note quitte la liste à sa propre sortie. */
const checkActiveNotes = (track: Track, calls: PaceCall[]): void => {
  const index = calls.findIndex((call) => call.notes.length > 1);
  assert.ok(index >= 0, "aucune annonce groupée");
  const [first, second] = calls[index].notes;
  const drive = startDrive(track, 1);
  const cue = createPaceNoteCue(track, calls, timing);
  while (feed(cue, drive)?.index !== index) advance(drive);
  const shown = cue.activeNotes();
  assert.ok(shown.includes(first) && shown.includes(second), "note absente");
  assert.ok(
    shown.every((note, i) => i === 0 || note.startS >= shown[i - 1].startS),
    "notes hors de l'ordre de la route",
  );
  while (drive.s <= first.endS + 3) {
    advance(drive);
    feed(cue, drive);
  }
  assert.ok(
    !cue.activeNotes().includes(first),
    "note dépassée encore affichée",
  );
  assert.ok(cue.activeNotes().includes(second), "note à venir retirée");
};

const checkDeterminism = (
  name: string,
  track: Track,
  calls: PaceCall[],
): void => {
  assert.deepEqual(
    runKinematic(name, track, calls, 1).said,
    runKinematic(name, track, calls, 1).said,
    `${name} : deux passages différents`,
  );
};

/** Ligne de départ en pleine épingle : un virage garde `endS` au-delà de `length`. */
const shiftedCircuit = (): Track => {
  const track = createSandboxTrack();
  const apex = track.indexAt(track.nearest(492, 559).s);
  return createTrack(
    [...track.points.slice(apex), ...track.points.slice(0, apex)],
    track.widths,
    true,
  );
};

export default async function check(): Promise<void> {
  const load = (file: string): StageData =>
    parseStage(JSON.parse(readFileSync(`public/stages/${file}.json`, "utf8")));
  const road = load("road");
  const mountain = load("mountain");
  const bench = createNotesBenchStage();
  const tracks: [string, Track][] = [
    ["track", createSandboxTrack()],
    ["road", createStageTrack(road)],
    ["mountain", createStageTrack(mountain)],
    ["notes", createStageTrack(bench)],
  ];

  for (const [name, track] of tracks) {
    const { calls } = computePaceNotes(track);
    for (const pace of [1, 1.6])
      report(
        name,
        `cinématique ×${pace}`,
        runKinematic(name, track, calls, pace).result,
      );
    checkDeterminism(name, track, calls);
    // Diction lente à l'allure de référence : les phrases les plus longues doivent aussi finir à l'heure.
    speechRate = SPEECH_RATES.lent;
    report(
      name,
      "cinématique ×1, diction lente",
      runKinematic(name, track, calls, 1).result,
    );
    speechRate = SPEECH_RATES.normal;
  }

  checkShort(tracks[3][1], computePaceNotes(tracks[3][1]).calls);

  const shifted = shiftedCircuit();
  const shiftedCalls = computePaceNotes(shifted).calls;
  assert.ok(shiftedCalls.some((call) => call.endS > shifted.length));
  runKinematic("track décalé", shifted, shiftedCalls, 1);

  const mountainTrack = tracks[2][1];
  const mountainCalls = computePaceNotes(mountainTrack).calls;
  checkReverse(mountainTrack, mountainCalls);
  checkRespawn(mountainTrack, mountainCalls);
  checkFinished(mountainTrack, mountainCalls);
  checkBranchJump(mountainTrack, mountainCalls);
  checkReplay(mountainTrack, mountainCalls);
  checkActiveNotes(mountainTrack, mountainCalls);

  await initRapier();
  runBot("track", undefined);
  runBot("notes", bench);
  runBot("road", road);
  runBot("mountain", mountain);
}
