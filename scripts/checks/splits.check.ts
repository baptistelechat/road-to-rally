import assert from "node:assert/strict";
import { createSplitTracker, splitDelta, splitGates } from "../../src/sim/splits";

export default async function check(): Promise<void> {
  // Trois secteurs égaux, quelle que soit la longueur : deux intermédiaires.
  assert.deepEqual(splitGates(0, 900), [300, 600]);
  assert.deepEqual(splitGates(100, 3000), [1100, 2100]);

  // Spéciale de 4,5 km après 50 m de prolongement : intermédiaires tous les 1 500 m.
  const splits = createSplitTracker({ startS: 50, finishS: 4550 });
  assert.deepEqual(splits.gates, [1550, 3050]);

  // Avant le départ, rien ne compte, même au-delà d'une porte.
  assert.equal(splits.update(1600, null), null);
  assert.equal(splits.update(1549, 40000), null);
  assert.deepEqual(splits.update(1550, 40017), { index: 0, ms: 40017 });
  // Un recul (remise en piste) puis un nouveau passage ne recompte pas la porte.
  assert.equal(splits.update(900, 45000), null);
  assert.equal(splits.update(1600, 50000), null);
  assert.deepEqual(splits.times(), [40017]);

  // Deux portes dans le même pas : toutes deux notées, la dernière renvoyée.
  splits.reset();
  assert.deepEqual(splits.update(3100, 90000), { index: 1, ms: 90000 });
  assert.deepEqual(splits.times(), [90000, 90000]);
  assert.equal(splits.update(4600, 120000), null);

  splits.reset();
  assert.deepEqual(splits.times(), []);
  assert.deepEqual(splits.update(1560, 39000), { index: 0, ms: 39000 });

  // Écart au record : négatif devant, `null` sans record ou sans ce passage.
  assert.equal(splitDelta([40000, 80000], { index: 0, ms: 39500 }), -500);
  assert.equal(splitDelta([40000, 80000], { index: 1, ms: 80250 }), 250);
  assert.equal(splitDelta([40000], { index: 1, ms: 80250 }), null);
  assert.equal(splitDelta(undefined, { index: 0, ms: 1 }), null);
}
