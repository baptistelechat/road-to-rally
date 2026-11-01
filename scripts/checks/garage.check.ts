import assert from "node:assert/strict";
import {
  buildGarageGeometry,
  GARAGE_CAMERA,
  LOW_PROP_HEIGHT,
} from "../../src/render/garage/buildGarageGeometry";
import { readableInk } from "../../src/render/garage/garageDecals";

// La caméra du garage ne doit traverser aucun élément du décor, où qu'elle aille dans ses limites.
export default async function check(): Promise<void> {
  const { shell, props, glow } = buildGarageGeometry({
    accent: "#d9472b",
    rim: "#d9a441",
  });
  const { target, maxDistance, minPolarAngle } = GARAGE_CAMERA;

  for (const geometry of [shell, props, glow]) {
    const position = geometry.getAttribute("position");
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const y = position.getY(i);
      const z = position.getZ(i);
      if (y < LOW_PROP_HEIGHT) continue;
      const dy = y - target[1];
      const distance = Math.hypot(x - target[0], dy, z - target[2]);
      const reachable =
        distance <= maxDistance &&
        (dy <= 0 || Math.acos(dy / distance) >= minPolarAngle);
      assert(
        !reachable,
        `Décor à portée de caméra : (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`,
      );
    }
  }

  assert.equal(readableInk("#1f3a5f"), "#ffffff");
  assert.equal(readableInk("#efe6d2"), "#111114");
  assert.equal(readableInk("#f5c518"), "#111114");
}
