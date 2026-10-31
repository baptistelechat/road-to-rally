import assert from "node:assert/strict";
import { initRapier, RAPIER } from "../../src/sim/rapier";
import { addTrackColliders } from "../../src/sim/track/colliders";
import { createTrack } from "../../src/sim/track/createTrack";
import { embankment, GROUND_Y, ribbon } from "../../src/sim/track/ribbon";
import {
  createSandboxTrack,
  SANDBOX_SECTIONS,
  sandboxSectionStarts,
} from "../../src/sim/track/sandboxTrack";
import { generateScenery } from "../../src/sim/track/scenery";
import type { MeshData, Pose, Track, Vec3 } from "../../src/sim/types";

const SEED = 1;

const checkTriangles = (mesh: MeshData, label: string): void => {
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
    assert.ok(ny > 0, `${label} : triangle ${t / 3} retourné`);
  }
};

/** Boucle fermée sans trou : chaque arête appartient à 2 triangles, sauf les 2 bords qui forment 2 boucles. */
const checkClosedRibbon = (mesh: MeshData): void => {
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
  checkClosedRibbon(track.ribbon);
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

const checkScenery = (track: Track): void => {
  const scenery = generateScenery(track, SEED);
  assert.ok(scenery.length > 500, `${scenery.length} éléments`);
  for (const kind of ["tree", "pine", "rock", "hay", "sign"])
    assert.ok(
      scenery.some((item) => item.kind === kind),
      `pas de ${kind}`,
    );
  for (const item of scenery) {
    const d = track.nearest(item.position.x, item.position.z).distance;
    assert.ok(d >= track.width / 2 + 2, `${item.kind} à ${d} m de l'axe`);
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
    const point = track.points[Math.floor(i / 6)];
    for (const inset of [0, 0.01, 0.2]) {
      const h = heightAt(
        x + (point.x - x) * inset,
        z + (point.z - z) * inset,
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
  const n = track.points.length;
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

export default async function check(): Promise<void> {
  const track = createSandboxTrack();
  checkShape(track);
  checkTightRadius();
  checkQueries(track);
  checkScenery(track);
  checkDeterminism();
  await checkColliders(track);
}
