import assert from "node:assert/strict";
import { analyzeDiag } from "../../src/game/diag/analyze";
import {
  COLUMN,
  createDiagHistory,
  createDiagRecorder,
} from "../../src/game/diag/recorder";
import { createInputRecorder } from "../../src/input/recorder";
import { initRapier } from "../../src/sim/rapier";
import { createSimulation } from "../../src/sim/simulation";
import { NEUTRAL_INPUT } from "../../src/sim/types";

const checkRecorder = (): void => {
  // L'anneau garde les lignes les plus récentes, dans l'ordre.
  const recorder = createDiagRecorder(3);
  for (let i = 1; i <= 5; i++) {
    recorder.row[COLUMN.t] = i;
    recorder.commit();
  }
  assert.deepEqual(
    recorder.data().rows.map((row) => row[COLUMN.t]),
    [3, 4, 5],
  );
};

const checkHistory = (): void => {
  // Les trous du son sont des totaux : chaque tranche ne garde que les siens.
  const history = createDiagHistory(1000, 2);
  history.cpu(5);
  history.cpu(3);
  history.workerStall(100);
  history.frame(100, 16, 4, 2, 10);
  history.frame(900, 40, 6, 5, 30);
  history.frame(1100, 16, 4, 5, 0);
  history.frame(2100, 16, 4, 6, 0);
  history.frame(3100, 16, 4, 6, 0);
  const rows = history.rows();
  assert.deepEqual(
    rows.map((row) => row.t),
    [1, 2, 3],
    "seules les tranches les plus récentes restent",
  );
  assert.deepEqual(
    rows.map((row) => row.underruns),
    [0, 1, 0],
  );

  const first = createDiagHistory(1000);
  first.cpu(5);
  first.cpu(3);
  first.workerStall(100);
  first.frame(100, 16, 4, 2, 10);
  first.frame(900, 40, 6, 5, 30);
  const [bucket] = first.rows();
  assert.equal(bucket.frames, 2);
  assert.equal(bucket.gapMax, 40);
  assert.equal(bucket.frameMsAvg, 5);
  assert.equal(bucket.underruns, 5);
  assert.equal(bucket.padAgeMax, 30);
  assert.equal(bucket.workerStalls, 1);
  assert.equal(bucket.cpuMs, 3, "le meilleur temps, pas le dernier");
};

const checkAnalysis = (): void => {
  // 10 s à 60 images/s, avec trois incidents posés à la main.
  const recorder = createDiagRecorder(1000);
  for (let i = 0; i < 600; i++) {
    const { row } = recorder;
    const t = i * (1000 / 60);
    row.fill(0);
    row[COLUMN.t] = t;
    row[COLUMN.frameGap] = i === 100 ? 200 : 1000 / 60;
    row[COLUMN.padConnected] = 1;
    row[COLUMN.throttle] = 1;
    row[COLUMN.padAge] = i >= 300 && i < 360 ? (i - 299) * 20 : 5;
    row[COLUMN.heapMb] = i === 400 ? 40 : i < 400 ? 40 + i * 0.1 : 40;
    row[COLUMN.audioUnderruns] = i < 500 ? 0 : 4;
    row[COLUMN.rumbleSends] = i / 10;
    recorder.commit();
  }
  recorder.event(9000, "mark");
  recorder.event(8000, "workerStall", 120);
  recorder.event(8500, "longTask", 90);
  const summary = analyzeDiag(recorder.data());
  assert.equal(summary.frames, 600);
  assert.equal(summary.fps, 60);
  assert.equal(summary.frameStalls.length, 1);
  assert.equal(summary.frameStalls[0].durationMs, 200);
  assert.equal(summary.padSilences.length, 1);
  assert.equal(summary.padSilences[0].durationMs, 1200);
  assert.equal(summary.heapDrops.length, 1);
  assert.equal(summary.audioUnderruns, 4);
  assert.equal(summary.eventCounts.mark, 1);
  const [mark] = summary.beforeMarks;
  assert.equal(mark.frameGapMax, 200);
  assert.equal(mark.padSilenceMax, 1200);
  assert.equal(mark.underruns, 4);
  assert.equal(mark.workerStalls, 1);
  assert.equal(mark.longTasks, 1);

  // Pédales relâchées : une manette silencieuse est normale, ce n'est pas un incident.
  const idle = createDiagRecorder(10);
  for (let i = 0; i < 10; i++) {
    idle.row.fill(0);
    idle.row[COLUMN.padConnected] = 1;
    idle.row[COLUMN.padAge] = 5000;
    idle.commit();
  }
  assert.equal(analyzeDiag(idle.data()).padSilences.length, 0);
};

const checkPropsAtRest = async (): Promise<void> => {
  // Objets endormis : plus aucune lecture ni mise à jour à faire à chaque image.
  await initRapier();
  const sim = createSimulation();
  for (let i = 0; i < 30; i++) sim.step(NEUTRAL_INPUT);
  assert.equal(sim.props.sync(), true, "premier relevé après la création");
  assert.equal(sim.props.sync(), false, "rien n'a bougé");
  const poses = sim.props.current();
  sim.step(NEUTRAL_INPUT);
  sim.props.sync();
  assert.equal(sim.props.current(), poses, "le tableau de poses est réutilisé");
  sim.restart();
  sim.step(NEUTRAL_INPUT);
  assert.equal(sim.props.sync(), true, "la relance replace les objets");
  sim.free();
};

const checkInputRecorderBounded = (): void => {
  // Un stick analogique change à chaque pas : c'est ce qui faisait grossir l'enregistrement.
  const recorder = createInputRecorder();
  for (let i = 0; i < 100; i++)
    recorder.record({ ...NEUTRAL_INPUT, steer: i / 1000 });
  assert.equal(recorder.frames().runs.length, 500);
};

export default async function check(): Promise<void> {
  checkRecorder();
  checkHistory();
  checkAnalysis();
  await checkPropsAtRest();
  checkInputRecorderBounded();
}
