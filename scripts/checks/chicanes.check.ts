// Placement des chicanes et modèles : sans réseau, depuis les spéciales committées dans public/stages/.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type BufferGeometry, Color } from "three";
import {
  chicaneBlocks,
  chicaneWidth,
  findStraights,
  placeChicanes,
  type ChicanePlacement,
} from "../../src/geo/chicanes";
import {
  CHICANE_BLOCK_DEPTH,
  CHICANE_EXCLUDED_CLEARANCE,
  CHICANE_GAP,
  CHICANE_LINE_CLEARANCE,
  CHICANE_MIN_BLOCKED,
  CHICANE_MIN_PASSAGE,
  CHICANE_SPACING,
  CHICANE_STACK_HEIGHT,
  MAX_WIDTH,
  MIN_WIDTH,
} from "../../src/geo/config";
import { RIG_TUNING } from "../../src/render/camera/cameraRig";
import { CHICANE_GEOMETRY } from "../../src/render/scenery/models";
import { carConfig } from "../../src/sim/carConfig";
import type { Vec3 } from "../../src/sim/types";

interface Fixture {
  points: Vec3[];
  widths: number[];
  startS: number;
  finishS: number;
}

const load = (id: string): Fixture =>
  JSON.parse(
    readFileSync(join("public", "stages", `${id}.json`), "utf8"),
  ) as Fixture;

const place = (
  fixture: Fixture,
  excluded = [] as { from: number; to: number }[],
) =>
  placeChicanes(fixture.points, fixture.widths, {
    startS: fixture.startS,
    finishS: fixture.finishS,
    excluded,
  });

const assertSortedAndSpaced = ({ chicanes }: ChicanePlacement): void => {
  for (let i = 1; i < chicanes.length; i++)
    assert.ok(
      chicanes[i].s - chicanes[i - 1].s >= CHICANE_SPACING - 1e-6,
      `écart ${chicanes[i].s - chicanes[i - 1].s}`,
    );
};

const straightFixture = (length: number, width: number): Fixture => {
  const points: Vec3[] = [];
  for (let i = 0; i * 2 <= length; i++) points.push({ x: 0, y: 0, z: -i * 2 });
  return {
    points,
    widths: points.map(() => width),
    startS: 250,
    finishS: length - 250,
  };
};

export default async function chicanesCheck(): Promise<void> {
  // Gabarit : le passage minimal laisse de la marge à la voiture, roues comprises.
  const carWidth =
    2 *
    Math.max(
      carConfig.bodyHalfExtents.x,
      carConfig.front.halfTrack + carConfig.front.wheelWidth / 2,
    );
  assert.ok(CHICANE_MIN_PASSAGE >= carWidth + 1, `voiture de ${carWidth} m`);
  assert.ok(
    CHICANE_GAP - CHICANE_BLOCK_DEPTH > 2 * carConfig.bodyHalfExtents.z * 3,
    "la voiture doit tenir entre les deux blocs",
  );

  // Caméras : la pile cache la sortie à la vue capot, la poursuite voit par-dessus.
  const chaseEye = carConfig.ride.height + RIG_TUNING.chaseHeight;
  const hoodEye = carConfig.ride.height + RIG_TUNING.hoodOffset.y;
  assert.ok(CHICANE_STACK_HEIGHT < chaseEye, `poursuite à ${chaseEye} m`);
  assert.ok(CHICANE_STACK_HEIGHT > hoodEye + 0.2, `capot à ${hoodEye} m`);

  // Modèles : hauteurs annoncées, et le rouge et le blanc du ruban sur les deux faces.
  CHICANE_GEOMETRY.hayStack.computeBoundingBox();
  const stackTop = CHICANE_GEOMETRY.hayStack.boundingBox?.max.y ?? 0;
  assert.ok(Math.abs(stackTop - CHICANE_STACK_HEIGHT) < 1e-6);

  // Panneau d'annonce : le dessin noir de l'un est le miroir exact de l'autre, et son premier virage part du bon côté.
  const bendsSpan = (geometry: BufferGeometry): [number, number] => {
    const colors = geometry.getAttribute("color");
    const positions = geometry.getAttribute("position");
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < colors.count; i++) {
      if (colors.getX(i) > 0.1) continue;
      min = Math.min(min, positions.getX(i));
      max = Math.max(max, positions.getX(i));
    }
    return [min, max];
  };
  const [rightMin, rightMax] = bendsSpan(CHICANE_GEOMETRY.signRight);
  const [leftMin, leftMax] = bendsSpan(CHICANE_GEOMETRY.signLeft);
  // L'entrée du dessin est décalée à l'opposé du premier virage.
  assert.ok(-rightMin > rightMax, "premier virage à droite");
  assert.ok(Math.abs(leftMin + rightMax) < 1e-6);
  assert.ok(Math.abs(leftMax + rightMin) < 1e-6);
  const barrierColors = CHICANE_GEOMETRY.chicaneBarrier.getAttribute("color");
  const tones = new Set<string>();
  for (let i = 0; i < barrierColors.count; i++)
    tones.add(
      new Color(
        barrierColors.getX(i),
        barrierColors.getY(i),
        barrierColors.getZ(i),
      ).getHexString(),
    );
  assert.ok(tones.size >= 3, "poteaux, rouge et blanc");

  // Fixtures.
  const road = load("road");
  const mountain = load("mountain");
  const roadPlacement = place(road);
  const mountainPlacement = place(mountain);
  assert.ok(roadPlacement.chicanes.length >= 1, "road sans chicane");
  assert.equal(roadPlacement.tooNarrow.length, 0);
  assertSortedAndSpaced(roadPlacement);
  const straights = findStraights(road.points, road.startS, road.finishS);
  for (const { s } of roadPlacement.chicanes) {
    assert.ok(s >= road.startS + CHICANE_LINE_CLEARANCE);
    assert.ok(s <= road.finishS - CHICANE_LINE_CLEARANCE);
    assert.ok(
      straights.some(({ from, to }) => s >= from && s <= to),
      `${s} hors d'une ligne droite`,
    );
  }
  assert.equal(
    findStraights(mountain.points, mountain.startS, mountain.finishS).length,
    0,
    "mountain n'a aucune ligne droite",
  );
  assert.equal(mountainPlacement.chicanes.length, 0, "mountain");
  console.log(
    `     road : ${roadPlacement.chicanes.map(({ s, side }) => `${s} (${side})`).join(", ")} ; mountain : ${mountainPlacement.chicanes.length}`,
  );

  // Plages exclues : la chicane s'en écarte, marge comprise.
  const zone = {
    from: roadPlacement.chicanes[0].s - 30,
    to: roadPlacement.chicanes[0].s + 30,
  };
  for (const { s } of place(road, [zone]).chicanes)
    assert.ok(
      s <= zone.from - CHICANE_EXCLUDED_CLEARANCE ||
        s >= zone.to + CHICANE_EXCLUDED_CLEARANCE,
      `${s} dans la plage exclue`,
    );

  // Plafond sur un long tracé tout droit : plusieurs chicanes, jamais plus d'une par km.
  const long = straightFixture(12500, 6.5);
  const longPlacement = place(long);
  const raced = (long.finishS - long.startS) / 1000;
  assert.ok(longPlacement.chicanes.length >= 2, "ligne droite non cassée");
  assert.ok(
    longPlacement.chicanes.length <= raced,
    `${longPlacement.chicanes.length} chicanes sur ${raced} km`,
  );
  assertSortedAndSpaced(longPlacement);
  // Le plafond tient aussi avec des plages exclues données dans le désordre.
  assertSortedAndSpaced(
    place(long, [
      { from: 6000, to: 6100 },
      { from: 1000, to: 1200 },
    ]),
  );

  // Route trop étroite : retirée et signalée.
  const narrow = place(straightFixture(3000, 4));
  assert.equal(narrow.chicanes.length, 0);
  assert.ok(narrow.tooNarrow.length >= 1, "chicane retirée non signalée");
  assert.equal(
    chicaneWidth(roadPlacement.chicanes[0].s, road.points, road.widths),
    6.5,
  );
  // Largeur qui se resserre sur la chicane : c'est le point le plus étroit qui compte.
  const pinched = straightFixture(3000, 6.5);
  const pinchedS = 1500 + CHICANE_GAP / 2;
  pinched.widths[Math.round(pinchedS / 2)] = 4;
  assert.equal(chicaneWidth(1500, pinched.points, pinched.widths), 4);

  // Déterminisme : deux calculs, sur des copies, donnent les mêmes bits, zéro négatif compris.
  for (const fixture of [road, mountain, long]) {
    const other = structuredClone(fixture);
    const first = place(fixture);
    assert.deepStrictEqual(place(other), first);
    for (const chicane of first.chicanes) {
      const width = chicaneWidth(chicane.s, fixture.points, fixture.widths);
      assert.deepStrictEqual(
        chicaneBlocks(chicane, width, other.points),
        chicaneBlocks(chicane, width, fixture.points),
      );
    }
  }

  // Passage libre sur toute largeur, du plus étroit au plus large.
  const axis = straightFixture(400, 6.5).points;
  let accepted = 0;
  for (let w = Math.round(MIN_WIDTH * 100); w <= MAX_WIDTH * 100; w++) {
    const width = w / 100;
    for (const side of ["left", "right"] as const) {
      const blocks = chicaneBlocks({ s: 200, side }, width, axis);
      if (width < CHICANE_MIN_PASSAGE + CHICANE_MIN_BLOCKED) {
        assert.equal(blocks, null, `route de ${width} m acceptée`);
        continue;
      }
      assert.ok(blocks, `route de ${width} m refusée`);
      accepted++;
      const [first, second] = blocks;
      assert.equal(first.side, side);
      assert.notEqual(second.side, side);
      assert.ok(first.s < second.s);
      for (const block of blocks) {
        // Bord intérieur du bloc, mesuré depuis l'axe : positif s'il dépasse l'axe du côté opposé.
        const inner = block.span / 2 - Math.abs(block.lateral);
        const free = width / 2 - inner;
        assert.ok(
          free >= CHICANE_MIN_PASSAGE - 1e-9,
          `route de ${width} m : passage de ${free} m`,
        );
        assert.ok(Math.abs(free - block.passage) < 1e-9);
        assert.ok(width - free >= CHICANE_MIN_BLOCKED - 1e-9);
        // Sur cet axe qui va vers -Z, la droite de la route est +X.
        assert.ok(Math.abs(block.position.x - block.lateral) < 1e-3);
        assert.equal(Object.is(block.yaw, -0), false);
        assert.equal(block.yaw, 0);
        assert.ok(
          block.side === "left" ? block.lateral < 0 : block.lateral > 0,
        );
      }
    }
  }
  assert.ok(accepted > 0);
}
