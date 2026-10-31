import assert from "node:assert/strict";
import {
  DoubleSide,
  FrontSide,
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  Vector3,
} from "three";
import { buildCarGeometry } from "../../src/render/car/buildCarGeometry";
import { defaultLivery } from "../../src/render/car/livery";
import { RIG_TUNING } from "../../src/render/camera/cameraRig";

// Depuis la vue capot, une face vue à l'envers n'est pas dessinée : on verrait la route à travers la voiture.
export default async function check(): Promise<void> {
  const { body } = buildCarGeometry(defaultLivery);
  const front = new Mesh(body, new MeshBasicMaterial({ side: FrontSide }));
  const both = new Mesh(body, new MeshBasicMaterial({ side: DoubleSide }));
  const { x, y, z } = RIG_TUNING.hoodOffset;
  const camera = new Vector3(x, y, z);
  const ray = new Raycaster();
  ray.near = 0.1;

  const tan = Math.tan(
    (((RIG_TUNING.hoodFov + RIG_TUNING.fovBoost) / 2) * Math.PI) / 180,
  );
  const wrong: string[] = [];
  let bodyHits = 0;
  for (let row = 0; row < 45; row++) {
    // Moitié basse de l'image : c'est là qu'on voit la voiture.
    const screenY = -((row + 0.5) / 45);
    for (let column = 0; column < 90; column++) {
      const screenX = ((column + 0.5) / 90) * 2 - 1;
      ray.set(
        camera,
        new Vector3(screenX * tan * 2, screenY * tan, -1).normalize(),
      );
      const anySide = ray.intersectObject(both)[0];
      if (!anySide) continue;
      bodyHits++;
      const frontSide = ray.intersectObject(front)[0];
      if (!frontSide || anySide.distance < frontSide.distance - 1e-4)
        wrong.push(
          `y=${anySide.point.y.toFixed(2)} z=${anySide.point.z.toFixed(2)}`,
        );
    }
  }
  assert.ok(
    bodyHits > 100,
    "la voiture devrait être visible depuis la vue capot",
  );
  assert.equal(
    wrong.length,
    0,
    `faces vues à l'envers : ${wrong.slice(0, 8).join(", ")}`,
  );
}
