import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { initRapier, RAPIER } from "../../src/sim/rapier";
import { addTrackColliders } from "../../src/sim/track/colliders";
import { createTrack } from "../../src/sim/track/createTrack";
import {
  embankment,
  GROUND_Y,
  lateralStrip,
  ribbon,
} from "../../src/sim/track/ribbon";
import {
  findRoadContact,
  SHOULDER_WIDTH,
  shoulderWidths,
} from "../../src/sim/track/roadContact";
import {
  createSandboxTrack,
  SANDBOX_SECTIONS,
  sandboxSectionStarts,
} from "../../src/sim/track/sandboxTrack";
import {
  finishArch,
  generateScenery,
  startArch,
} from "../../src/sim/track/scenery";
import { createStageTrack } from "../../src/sim/track/stage";
import { parseStage } from "../../src/sim/track/stageCodec";
import type { MeshData, Pose, Track, Vec3 } from "../../src/sim/types";
import { axisFrom, type Leg } from "./stage.check";

const SEED = 1;

const checkTriangles = (
  mesh: MeshData,
  label: string,
  facingUp = true,
): void => {
  const p = mesh.positions;
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const [a, b, c] = [
      mesh.indices[t],
      mesh.indices[t + 1],
      mesh.indices[t + 2],
    ];
    const ux = p[b * 3] - p[a * 3];
    const uy = p[b * 3 + 1] - p[a * 3 + 1];
    const uz = p[b * 3 + 2] - p[a * 3 + 2];
    const vx = p[c * 3] - p[a * 3];
    const vy = p[c * 3 + 1] - p[a * 3 + 1];
    const vz = p[c * 3 + 2] - p[a * 3 + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const area = Math.hypot(nx, ny, nz) / 2;
    assert.ok(area > 1e-3, `${label} : triangle ${t / 3} d'aire ${area}`);
    if (facingUp) assert.ok(ny > 0, `${label} : triangle ${t / 3} retourné`);
  }
};

/** Sans trou : chaque arête appartient à 2 triangles, sauf les bords, 2 boucles sur un tracé fermé et une seule sur un tracé ouvert. */
const checkRibbonEdges = (mesh: MeshData, loops = 2): void => {
  const edges = new Map<string, number>();
  for (let t = 0; t < mesh.indices.length; t += 3)
    for (let k = 0; k < 3; k++) {
      const a = mesh.indices[t + k];
      const b = mesh.indices[t + ((k + 1) % 3)];
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  const boundary: [number, number][] = [];
  for (const [key, count] of edges) {
    assert.ok(count <= 2, `arête ${key} partagée par ${count} triangles`);
    if (count === 1)
      boundary.push(key.split("-").map(Number) as [number, number]);
  }
  const vertices = mesh.positions.length / 3;
  assert.equal(boundary.length, vertices, "nombre d'arêtes de bord");
  const degree = new Map<number, number>();
  for (const [a, b] of boundary) {
    degree.set(a, (degree.get(a) ?? 0) + 1);
    degree.set(b, (degree.get(b) ?? 0) + 1);
  }
  for (const [vertex, d] of degree)
    assert.equal(d, 2, `sommet de bord ${vertex} : degré ${d}`);
  // Union-find sur les arêtes de bord : autant de composantes que de boucles.
  const parent = new Map<number, number>();
  const find = (v: number): number => {
    const p = parent.get(v) ?? v;
    if (p === v) return v;
    const root = find(p);
    parent.set(v, root);
    return root;
  };
  for (const [a, b] of boundary) parent.set(find(a), find(b));
  const roots = new Set(boundary.map(([a]) => find(a)));
  assert.equal(roots.size, loops, "nombre de boucles de bord");
};

const forwardOf = ({ rotation: q }: Pose): Vec3 => ({
  // Image de (0, 0, -1) par le quaternion.
  x: -2 * (q.x * q.z + q.w * q.y),
  y: -2 * (q.y * q.z - q.w * q.x),
  z: -(1 - 2 * (q.x * q.x + q.y * q.y)),
});

const minRadius = (points: Vec3[]): number => {
  const n = points.length;
  let min = Infinity;
  for (let i = 0; i < n; i++) {
    const a = points[(i - 2 + n) % n];
    const b = points[i];
    const c = points[(i + 2) % n];
    const ux = b.x - a.x;
    const uz = b.z - a.z;
    const vx = c.x - b.x;
    const vz = c.z - b.z;
    const angle = Math.abs(Math.atan2(ux * vz - uz * vx, ux * vx + uz * vz));
    const arc = (Math.hypot(ux, uz) + Math.hypot(vx, vz)) / 2;
    if (angle > 0) min = Math.min(min, arc / angle);
  }
  return min;
};

const sectionRange = (track: Track, name: string): [number, number] => {
  const starts = sandboxSectionStarts(track);
  const index = SANDBOX_SECTIONS.findIndex((s) => s.name === name);
  assert.ok(index >= 0, `section ${name} absente`);
  return [starts[index], starts[index + 1] ?? track.length];
};

const checkShape = (track: Track): void => {
  assert.ok(
    track.length >= 1800 && track.length <= 2400,
    `longueur ${track.length}`,
  );
  assert.equal(track.closed, true);
  assert.equal(track.width, 6);

  const step = track.length / track.points.length;
  track.points.forEach((p, i) => {
    const q = track.points[(i + 1) % track.points.length];
    const d = Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z);
    assert.ok(
      Math.abs(d - step) < 0.05 * step,
      `pas irrégulier en ${i} : ${d}`,
    );
    assert.ok(p.y >= 0);
  });

  const radius = minRadius(track.points);
  assert.ok(radius > track.width / 2, `rayon mini ${radius}`);
  assert.ok(radius >= 9.5 && radius <= 12.5, `épingle de rayon ${radius}`);

  checkTriangles(track.ribbon, "ruban");
  checkRibbonEdges(track.ribbon);
  const bank = embankment(track.points, track.width, track.closed);
  assert.ok(bank, "talus absent sous la crête");
  checkTriangles(bank, "talus");

  // Auto-croisement et portions non voisines à plus de 12 m : les points sont espacés de 2 m.
  const n = track.points.length;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const along = Math.min(j - i, n - j + i) * step;
      if (along < 40) continue;
      const d = Math.hypot(
        track.points[i].x - track.points[j].x,
        track.points[i].z - track.points[j].z,
      );
      assert.ok(d > 12, `portions à ${d} m (s=${i * step}, ${j * step})`);
    }

  // Toutes les sections existent, dans l'ordre, et la ligne droite a plus de 300 m sans courbure notable.
  const starts = sandboxSectionStarts(track);
  starts
    .slice(1)
    .forEach((s, i) => assert.ok(s > starts[i], "ordre des sections"));
  let straight = 0;
  let best = 0;
  const [, straightEnd] = sectionRange(track, "Longue ligne droite");
  for (let i = 0; i * step < straightEnd; i++) {
    straight = Math.abs(track.points[i].z) < 0.5 ? straight + step : 0;
    best = Math.max(best, straight);
  }
  assert.ok(best >= 300, `ligne droite de ${best} m`);

  // Crête et bosse existent, et le reste est plat.
  const maxIn = (name: string): number => {
    const [from, to] = sectionRange(track, name);
    let max = 0;
    track.points.forEach((p, i) => {
      if (i * step >= from - 10 && i * step <= to + 10)
        max = Math.max(max, p.y);
    });
    return max;
  };
  assert.ok(maxIn("Crête") > 2, "crête absente");
  assert.ok(maxIn("Bosse") > 0.3, "bosse absente");
  const raised = track.points.filter((p) => p.y > 0).length * step;
  assert.ok(raised < 110, `${raised} m surélevés`);
};

/** Un rayon trop serré ne doit jamais replier le ruban : le bord intérieur se resserre. */
const checkTightRadius = (): void => {
  for (const radius of [1, 2, 3, 5]) {
    const count = Math.max(12, Math.round((2 * Math.PI * radius) / 0.5));
    const circle: Vec3[] = Array.from({ length: count }, (_, i) => ({
      x: radius * Math.cos((2 * Math.PI * i) / count),
      y: 0,
      z: radius * Math.sin((2 * Math.PI * i) / count),
    }));
    checkTriangles(ribbon(circle, 6, true), `cercle de rayon ${radius}`);
    checkTriangles(
      ribbon([...circle].reverse(), 6, true),
      `cercle inverse de rayon ${radius}`,
    );
  }
  // Ligne droite, virage très serré, ligne droite : le passage brutal ne doit rien replier.
  const bend: Vec3[] = [];
  for (let x = -30; x < 0; x += 1) bend.push({ x, y: 0, z: 0 });
  for (let a = 0; a < 16; a++) {
    const angle = (a / 16) * Math.PI;
    bend.push({ x: 2 * Math.sin(angle), y: 0, z: 2 - 2 * Math.cos(angle) });
  }
  for (let x = 0; x > -30; x -= 1) bend.push({ x, y: 0, z: 4 });
  checkTriangles(ribbon(bend, 6, false), "épingle brutale");
};

const checkQueries = (track: Track): void => {
  track.points.forEach((p, i) => {
    // Au point lui-même, à droite puis à gauche : distance, surface et sens.
    const q = track.points[(i + 1) % track.points.length];
    const len = Math.hypot(q.x - p.x, q.z - p.z);
    const rx = -(q.z - p.z) / len;
    const rz = (q.x - p.x) / len;

    const on = track.nearest(p.x, p.z);
    assert.ok(on.distance < 1e-6, `nearest à ${on.distance} m en ${i}`);
    const dot = on.tangent.x * (q.x - p.x) + on.tangent.z * (q.z - p.z);
    assert.ok(dot > -1e-9, `tangente en ${i}`);

    for (const side of [-1, 1]) {
      const inX = p.x + rx * side * 2.5;
      const inZ = p.z + rz * side * 2.5;
      const outX = p.x + rx * side * 5;
      const outZ = p.z + rz * side * 5;
      assert.equal(track.surfaceAt(inX, inZ), "asphalt", `surface en ${i}`);
      assert.equal(track.surfaceAt(outX, outZ), "grass", `surface en ${i}`);
      assert.ok(Math.abs(track.nearest(outX, outZ).distance - 5) < 0.2);

      const pose = track.respawnPose(outX, outZ);
      const f = forwardOf(pose);
      const near = track.nearest(outX, outZ);
      assert.ok(
        f.x * near.tangent.x + f.z * near.tangent.z > 0.99,
        `remise en piste à contresens en ${i}`,
      );
      assert.ok(
        pose.position.y > near.point.y,
        "remise en piste sous la route",
      );
    }
  });

  const start = forwardOf(track.startPose);
  assert.ok(start.x > 0.99, "pose de départ orientée vers la ligne droite");
  // s croît le long de la route.
  const mid = track.points[300];
  assert.ok(
    Math.abs(
      track.nearest(mid.x, mid.z).s -
        (300 * track.length) / track.points.length,
    ) < 2,
  );
  // Tracé ouvert : les extrémités restent valides.
  const open = createTrack(
    [
      { x: 0, y: 0, z: 0 },
      { x: 10, y: 0, z: 0 },
    ],
    6,
    false,
  );
  assert.equal(open.length, 10);
  assert.equal(open.nearest(50, 0).s, 10);
  assert.equal(open.ribbon.indices.length, 6);
};

const checkScenery = (track: Track, sandbox = true): void => {
  const scenery = generateScenery(track, SEED);
  assert.ok(
    scenery.length > (sandbox ? 500 : 100),
    `${scenery.length} éléments`,
  );
  if (sandbox)
    for (const kind of ["tree", "pine", "rock", "hay", "sign"])
      assert.ok(
        scenery.some((item) => item.kind === kind),
        `pas de ${kind}`,
      );
  for (const item of scenery) {
    const { distance: d, width } = track.nearest(
      item.position.x,
      item.position.z,
    );
    assert.ok(d >= width / 2 + 2, `${item.kind} à ${d} m de l'axe`);
    assert.ok(Number.isFinite(item.position.y), `${item.kind} sans altitude`);
  }
  assert.ok(scenery.some((item) => item.colliderRadius > 0));
  assert.ok(scenery.some((item) => item.colliderRadius === 0));
  assert.notDeepEqual(generateScenery(track, SEED + 1), scenery);
};

const checkDeterminism = (): void => {
  const a = createSandboxTrack();
  const b = createSandboxTrack();
  assert.deepEqual(a.points, b.points);
  assert.deepEqual(a.ribbon.positions, b.ribbon.positions);
  assert.deepEqual(a.ribbon.indices, b.ribbon.indices);
  assert.deepEqual(a.startPose, b.startPose);
  assert.deepEqual(generateScenery(a, SEED), generateScenery(b, SEED));
};

const checkColliders = async (track: Track): Promise<void> => {
  await initRapier();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  addTrackColliders(world, track, generateScenery(track, SEED));
  world.step();

  const heightAt = (x: number, z: number, top: number): number => {
    const ray = new RAPIER.Ray({ x, y: top + 6, z }, { x: 0, y: -1, z: 0 });
    const hit = world.castRay(ray, 40, true);
    assert.ok(hit, `aucun sol en (${x}, ${z})`);
    return top + 6 - hit.timeOfImpact;
  };

  const ribbonPositions = track.ribbon.positions;
  const tolerance = 0.01;
  let edgeFallbacks = 0;
  for (let i = 0; i < ribbonPositions.length; i += 3) {
    const [x, y, z] = [
      ribbonPositions[i],
      ribbonPositions[i + 1],
      ribbonPositions[i + 2],
    ];
    // Un rayon pile sur une arête du trimesh peut passer entre deux triangles (arrondi Float32, environ 15 cas par million) :
    // il doit alors retomber sur le sol ou le talus juste dessous, jamais plus bas.
    const station = Math.floor(i / 6);
    const point = track.points[station];
    // Tracé ouvert : la digue a ses arêtes sur la même section que la route, le rayon s'en écarte de 2 cm le long de l'axe.
    const beside = track.closed
      ? point
      : (track.points[station + 1] ?? track.points[station - 1]);
    const shift = track.closed
      ? 0
      : 0.02 / (Math.hypot(beside.x - point.x, beside.z - point.z) || 1);
    for (const inset of [0, 0.01, 0.2]) {
      const h = heightAt(
        x + (point.x - x) * inset + (beside.x - point.x) * shift,
        z + (point.z - z) * inset + (beside.z - point.z) * shift,
        y,
      );
      assert.ok(
        h >= y + GROUND_Y - tolerance && h <= y + tolerance,
        `route à ${h}, attendu ${y} (sommet ${i / 3})`,
      );
      if (inset > 0 && Math.abs(h - y) >= tolerance) edgeFallbacks++;
    }
  }
  assert.ok(
    edgeFallbacks <= (ribbonPositions.length / 3) * 3 * 0.005,
    `${edgeFallbacks} rayons passés sous la route`,
  );

  // Centres des triangles : aucune fissure entre deux segments.
  for (let t = 0; t < track.ribbon.indices.length; t += 3) {
    const ids = [
      track.ribbon.indices[t],
      track.ribbon.indices[t + 1],
      track.ribbon.indices[t + 2],
    ];
    const c = (axis: number): number =>
      ids.reduce((sum, id) => sum + ribbonPositions[id * 3 + axis], 0) / 3;
    assert.ok(
      Math.abs(heightAt(c(0), c(2), c(1)) - c(1)) < tolerance,
      `triangle ${t / 3}`,
    );
  }

  // Sortie et retour partout : pas de marche infranchissable du centre de la route jusqu'à 40 m, des deux côtés.
  // Sur un tracé ouvert, la digue plafonnée est une falaise assumée jusqu'à la story 2.6.
  const n = track.closed ? track.points.length : 0;
  for (let i = 0; i < n; i++) {
    const p = track.points[i];
    // Tous les points sur les reliefs, un sur dix ailleurs : le sol y est plat.
    if (p.y <= 0 && i % 10 !== 0) continue;
    const q = track.points[(i + 1) % n];
    const len = Math.hypot(q.x - p.x, q.z - p.z);
    const rx = -(q.z - p.z) / len;
    const rz = (q.x - p.x) / len;
    for (const side of [-1, 1]) {
      let previous = heightAt(p.x, p.z, p.y);
      let previousD = 0;
      for (let d = 0.5; d <= 30; d += 0.5) {
        const h = heightAt(p.x + rx * side * d, p.z + rz * side * d, p.y);
        // Les cylindres du décor proche sont hauts et verticaux : c'est voulu, on les saute.
        if (h > p.y + 0.5) continue;
        const slope = Math.abs(h - previous) / (d - previousD);
        assert.ok(slope < 0.3, `pente de ${slope} en s=${i}, d=${d}`);
        previous = h;
        previousD = d;
      }
    }
  }
  world.free();
};

/** La grille interne de `nearest` rend exactement ce que rend le parcours complet. */
const checkNearestGrid = (track: Track): void => {
  const { points, closed } = track;
  const n = points.length;
  const segments = closed ? n : n - 1;
  const brute = (x: number, z: number): { i: number; t: number } => {
    let best = { i: 0, t: 0, d2: Infinity };
    for (let i = 0; i < segments; i++) {
      const a = points[i];
      const b = points[(i + 1) % n];
      const abx = b.x - a.x;
      const abz = b.z - a.z;
      const len2 = abx * abx + abz * abz;
      const t =
        len2 > 0
          ? Math.max(0, Math.min(1, ((x - a.x) * abx + (z - a.z) * abz) / len2))
          : 0;
      const d2 = (a.x + abx * t - x) ** 2 + (a.z + abz * t - z) ** 2;
      if (d2 < best.d2) best = { i, t, d2 };
    }
    return best;
  };
  // Autour de la route, jusque loin dehors pour couvrir le repli sur le parcours complet.
  for (let k = 0; k < 400; k++) {
    const p = points[(k * 37) % n];
    const reach = [0, 1, 7, 40, 150, 700][k % 6];
    const x = p.x + reach * Math.cos(k);
    const z = p.z + reach * Math.sin(k);
    const { i, t } = brute(x, z);
    const a = points[i];
    const b = points[(i + 1) % n];
    const sample = track.nearest(x, z);
    assert.equal(
      sample.point.x,
      a.x + (b.x - a.x) * t,
      `grille en (${x}, ${z})`,
    );
    assert.equal(
      sample.point.z,
      a.z + (b.z - a.z) * t,
      `grille en (${x}, ${z})`,
    );
  }
};

const checkRoadContact = (): void => {
  const flat = (): number => 0;
  const serpentine = (radius: number): Vec3[] => {
    const legs: Leg[] = [
      { length: 60, turn: 0 },
      { length: Math.PI * radius, turn: Math.PI },
      { length: 60, turn: 0 },
    ];
    return axisFrom(legs, flat);
  };
  const fill = (points: Vec3[], width: number): number[] =>
    points.map(() => width);

  // Épingle de rayon 8 m en 9 m de large : chaussées et bas-côtés dégagés.
  const clear = serpentine(8);
  assert.equal(findRoadContact(clear, fill(clear, 9)), null);
  assert.ok(
    shoulderWidths(clear, fill(clear, 9), false).every(
      (s) => s === SHOULDER_WIDTH,
    ),
  );

  // Rayon 6 m : branches à 12 m. Les chaussées passent, les bas-côtés se partagent ce qui reste.
  const tight = serpentine(6);
  assert.equal(findRoadContact(tight, fill(tight, 9)), null);
  const shoulders = shoulderWidths(tight, fill(tight, 9), false);
  assert.ok(
    Math.min(...shoulders) > 0.8 && Math.min(...shoulders) < 1.6,
    `bas-côté rétréci à ${Math.min(...shoulders)} m`,
  );
  shoulders
    .slice(1)
    .forEach((s, i) =>
      assert.ok(
        Math.abs(s - shoulders[i]) <= 0.401,
        `marche de bas-côté en ${i}`,
      ),
    );

  // Rayon 3 m : branches à 6 m pour 9 m de large. Refusé, à l'endroit du contact.
  const pinched = serpentine(3);
  const contact = findRoadContact(pinched, fill(pinched, 9));
  assert.ok(contact, "chaussées qui se touchent non détectées");
  assert.ok(contact.sB > contact.sA && contact.sA < 60 && contact.sB > 60);

  // Un croisement à plat est un contact, quel que soit son angle.
  const crossing = axisFrom(
    [
      { length: 40, turn: 0 },
      { length: Math.PI * 1.5 * 20, turn: Math.PI * 1.5 },
      { length: 80, turn: 0 },
    ],
    flat,
  );
  assert.ok(findRoadContact(crossing, fill(crossing, 6)), "croisement");
};

const checkOpenTrack = async (track: Track, label: string): Promise<void> => {
  checkTriangles(track.ribbon, `${label} : ruban`);
  checkRibbonEdges(track.ribbon, 1);
  // Pleine largeur jusqu'au bout : aucune extrémité pincée.
  for (const i of [0, track.points.length - 1]) {
    const p = track.ribbon.positions;
    const across = Math.hypot(
      p[i * 6] - p[i * 6 + 3],
      p[i * 6 + 2] - p[i * 6 + 5],
    );
    assert.ok(
      Math.abs(across - track.widths[i]) < 0.01,
      `${label} : extrémité large de ${across} m`,
    );
  }
  const half = track.widths.map((w) => w / 2);
  const edge = half.map((h, i) => h + track.shoulders[i]);
  const negate = (values: number[]): number[] => values.map((v) => -v);
  for (const strip of [
    lateralStrip(track.points, false, negate(edge), negate(half), GROUND_Y),
    lateralStrip(track.points, false, half, edge, GROUND_Y),
  ]) {
    checkTriangles(strip, `${label} : bas-côté`);
    checkRibbonEdges(strip, 1);
  }
  const bank = embankment(track.points, track.widths, false);
  if (bank) checkTriangles(bank, `${label} : digue`, false);
  assert.equal(
    findRoadContact(track.points, track.widths),
    null,
    `${label} : chaussées qui se touchent`,
  );
  assert.ok(track.widths.every((w) => w <= track.width));
  assert.ok(track.shoulders.every((s) => s > 0 && s <= SHOULDER_WIDTH));

  // Départ et arrivée à leur place, arches comprises.
  const near = (a: Vec3, s: number): void => {
    const sample = track.nearest(a.x, a.z);
    assert.ok(
      Math.abs(sample.s - s) < 3,
      `${label} : arche à ${sample.s}, attendue à ${s}`,
    );
  };
  near(startArch(track).position, track.startS + 14);
  near(finishArch(track).position, track.finishS);

  checkNearestGrid(track);
  checkScenery(track, false);
  await checkColliders(track);
};

/** Épingle de rayon minimal à 20 %, en largeur maximale, puis largeur qui change en plein virage. */
const hardestTracks = (): [Track, string][] => {
  const legs: Leg[] = [
    { length: 60, turn: 0 },
    { length: Math.PI * 8, turn: Math.PI },
    { length: 60, turn: 0 },
    { length: Math.PI * 8, turn: -Math.PI },
    { length: 60, turn: 0 },
    { length: Math.PI * 8, turn: Math.PI },
    { length: 60, turn: 0 },
  ];
  const points = axisFrom(legs, () => 0.2);
  const varying = points.map(
    (_, i) => 6.25 + 2.75 * Math.sin((2 * Math.PI * i) / 25),
  );
  const lines = {
    startS: 30,
    finishS: (points.length - 1) * 2 - 30,
    terrain: null,
  };
  return [
    [createTrack(points, 9, false, lines), "épingle dure"],
    [createTrack(points, varying, false, lines), "largeur variable"],
  ];
};

export default async function check(): Promise<void> {
  checkRoadContact();
  for (const [track, label] of hardestTracks())
    await checkOpenTrack(track, label);
  for (const fixture of ["road", "mountain"]) {
    const path = `public/stages/${fixture}.json`;
    if (!existsSync(path)) continue;
    const stage = parseStage(JSON.parse(readFileSync(path, "utf8")));
    await checkOpenTrack(createStageTrack(stage), fixture);
  }

  const track = createSandboxTrack();
  checkNearestGrid(track);
  checkShape(track);
  checkTightRadius();
  checkQueries(track);
  checkScenery(track);
  checkDeterminism();
  await checkColliders(track);
}
