import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initRapier } from "../../src/sim/rapier";
import { createSimulation } from "../../src/sim/simulation";
import { createTrack } from "../../src/sim/track/createTrack";
import { createNotesBenchStage } from "../../src/sim/track/notesBenchTrack";
import {
  computePaceNotes,
  type PaceCall,
  type PaceNote,
  type PaceNotes,
  type PaceTurn,
} from "../../src/sim/track/paceNotes";
import { findRoadContact } from "../../src/sim/track/roadContact";
import {
  createSandboxTrack,
  SANDBOX_SECTIONS,
  sandboxSectionStarts,
} from "../../src/sim/track/sandboxTrack";
import { createStageTrack } from "../../src/sim/track/stage";
import { parseStage } from "../../src/sim/track/stageCodec";
import { NEUTRAL_INPUT, type Track } from "../../src/sim/types";

/** Virage de plus de 45° : cap qui tourne d'autant sur cette distance, en points de l'axe. */
const SHARP_WINDOW = 30;
const SHARP_ANGLE = Math.PI / 4;

const describeNote = (note: PaceNote): string => {
  if (note.kind !== "turn") return note.kind;
  const details = [note.long && "long", note.tightens && "tightens"].filter(
    Boolean,
  );
  return [note.direction, note.grade, ...details].join(" ");
};

const describeCall = ({ type, notes }: PaceCall): string =>
  `${type}: ${notes.map(describeNote).join(", ")}`;

const turnsOf = ({ notes }: PaceNotes): PaceTurn[] =>
  notes.flatMap((note) => (note.kind === "turn" ? [note] : []));

/** Chaque note appartient à exactement une annonce, et tout est trié par abscisse. */
const checkStructure = (result: PaceNotes, track: Track): void => {
  const { notes, calls } = result;
  assert.deepEqual(
    calls.flatMap((call) => call.notes).sort((a, b) => a.startS - b.startS),
    notes,
    "notes et annonces différentes",
  );
  for (const list of [notes, calls])
    list.slice(1).forEach((item, i) => {
      assert.ok(item.startS >= list[i].startS, "annonces mal triées");
    });
  for (const note of notes) {
    assert.ok(note.endS > note.startS, "note vide");
    assert.ok(note.startS >= track.startS, "note avant le départ");
    if (!track.closed)
      assert.ok(note.endS <= track.finishS, "note après l'arrivée");
  }
};

const sectionOf = (track: Track, name: string): [number, number] => {
  const starts = sandboxSectionStarts(track);
  const index = SANDBOX_SECTIONS.findIndex((section) => section.name === name);
  return [starts[index], starts[index + 1] ?? track.length];
};

const overlaps = (
  { startS, endS }: PaceNote,
  [from, to]: [number, number],
): boolean => startS < to && endS > from;

const checkBench = async (): Promise<void> => {
  const stage = createNotesBenchStage();
  const track = createStageTrack(stage);
  assert.equal(findRoadContact(track.points, track.widths), null);
  const result = computePaceNotes(track);
  checkStructure(result, track);
  // Écrite à la main d'après `NOTES_BENCH_SECTIONS`.
  assert.deepEqual(result.calls.map(describeCall), [
    "single: left 1",
    "single: right 1",
    "single: right 2",
    "single: left 2",
    "single: left 3",
    "single: right 3",
    "single: right 4",
    "single: left 4",
    "single: left 5",
    "single: right 5",
    "single: right 6",
    "single: left 6",
    "single: left 5 long",
    "single: right 4",
    "single: right 3 tightens",
    "single: left 4",
    "single: crest",
    "single: bump",
    "pair: left 3, right 4",
    "chain: left 2, right 2, left 2",
  ]);

  // La carte se roule comme toute spéciale.
  await initRapier();
  const sim = createSimulation(undefined, stage);
  for (let i = 0; i < 60; i++) sim.step(NEUTRAL_INPUT);
  assert.ok(Number.isFinite(sim.state().position.y));
  sim.free();
};

const checkCircuit = (): void => {
  const track = createSandboxTrack();
  const result = computePaceNotes(track);
  checkStructure(result, track);

  const inSection = (name: string): PaceNote[] => {
    const range = sectionOf(track, name);
    return result.notes.filter((note) => overlaps(note, range));
  };
  const hairpin = inSection("Épingle").filter((n) => n.kind === "turn");
  assert.ok(
    hairpin.some((turn) => turn.grade === 1),
    "épingle sans note 1",
  );
  const chicane = result.calls.find(
    ({ type, notes }) =>
      type === "chain" &&
      notes.some((note) => overlaps(note, sectionOf(track, "Chicane"))),
  );
  assert.equal(chicane?.notes.length, 3, "chicane sans enfilade de 3 virages");
  // Crête douce, 2,5 m sur 80 m : la voiture s'y allège à peine, elle n'est plus annoncée. La piste d'essai garde une vraie crête.
  assert.ok(
    !inSection("Crête").some((note) => note.kind === "crest"),
    "ondulation annoncée comme une crête",
  );
  assert.ok(
    inSection("Bosse").some((note) => note.kind === "bump"),
    "bosse absente",
  );
  assert.ok(
    inSection("Virage qui se resserre").some(
      (note) => note.kind === "turn" && note.tightens,
    ),
    "virage qui se resserre non reconnu",
  );
  // Même tracé, mais la ligne de départ tombe au milieu de l'épingle.
  const apex = track.indexAt(track.nearest(492, 559).s);
  const shifted = createTrack(
    [...track.points.slice(apex), ...track.points.slice(0, apex)],
    track.widths,
    true,
  );
  const again = computePaceNotes(shifted);
  checkStructure(again, shifted);
  assert.equal(
    turnsOf(again).length,
    turnsOf(result).length,
    "virage coupé par la ligne de départ",
  );
  const straddling = turnsOf(again).filter(
    (turn) => turn.endS > shifted.length,
  );
  assert.equal(straddling.length, 1, "un seul virage à cheval sur la ligne");
  assert.equal(straddling[0].grade, 1);
  assert.equal(straddling[0].direction, "right");
};

/** Tout tournant de plus de 45° mesuré sur l'axe, sans passer par la courbure, tombe dans une note. */
const checkStage = (name: string): void => {
  const stage = parseStage(
    JSON.parse(readFileSync(`public/stages/${name}.json`, "utf8")),
  );
  const track = createStageTrack(stage);
  const result = computePaceNotes(track);
  checkStructure(result, track);
  const { points } = track;
  const heading = (i: number): number =>
    Math.atan2(points[i + 1].z - points[i].z, points[i + 1].x - points[i].x);
  const sOf = [0];
  for (let i = 1; i < points.length; i++)
    sOf.push(
      sOf[i - 1] +
        Math.hypot(
          points[i].x - points[i - 1].x,
          points[i].y - points[i - 1].y,
          points[i].z - points[i - 1].z,
        ),
    );
  let sharp = 0;
  for (let i = 0; i + SHARP_WINDOW + 1 < points.length; i++) {
    const to = i + SHARP_WINDOW;
    if (sOf[i] < track.startS || sOf[to] > track.finishS) continue;
    const delta = heading(to) - heading(i);
    const turned = Math.abs(Math.atan2(Math.sin(delta), Math.cos(delta)));
    if (turned < SHARP_ANGLE) continue;
    sharp++;
    assert.ok(
      turnsOf(result).some((turn) => overlaps(turn, [sOf[i], sOf[to]])),
      `${name} : tournant sans note vers s=${sOf[i]}`,
    );
  }
  assert.ok(sharp > 0, `${name} : aucun tournant de plus de 45° trouvé`);

  assert.deepEqual(
    computePaceNotes(createStageTrack(stage)),
    result,
    `${name} : annonces différentes sur les mêmes points`,
  );
};

export default async function check(): Promise<void> {
  await checkBench();
  checkCircuit();
  checkStage("road");
  checkStage("mountain");
}
