import assert from "node:assert/strict";
import {
  miniMapOutline,
  screenHeading,
} from "../../src/game/Hud/miniMapOutline";
import type { Track } from "../../src/sim/types";

export default async function check(): Promise<void> {
  const yaw = (radians: number) => ({
    x: 0,
    y: Math.sin(radians / 2),
    z: 0,
    w: Math.cos(radians / 2),
  });

  // Avant = -Z local = nord à l'écran. Un lacet de +90° autour de Y tourne l'avant vers -X, l'ouest.
  assert.ok(Math.abs(screenHeading(yaw(0))) < 1e-9, "nord en haut");
  assert.ok(
    Math.abs(screenHeading(yaw(Math.PI / 2)) + 90) < 1e-9,
    "ouest à gauche",
  );
  assert.ok(
    Math.abs(screenHeading(yaw(-Math.PI / 2)) - 90) < 1e-9,
    "est à droite",
  );

  // 2 m à plat sur la première moitié, 6 m sur la seconde : à mi-index, le trait n'a fait qu'un quart du chemin.
  const points = Array.from({ length: 101 }, (_, i) => ({
    x: i <= 50 ? i * 2 : 100 + (i - 50) * 6,
    y: 0,
    z: 0,
  }));
  const line = {
    points,
    closed: false,
    startS: 0,
    finishS: 400,
    indexAt: (s: number) => Math.round(s / 4),
  } as unknown as Track;
  const { doneAt } = miniMapOutline(line);
  assert.ok(
    Math.abs(doneAt(50) - 0.25) < 1e-9,
    "à mi-index, un quart du trait",
  );
  assert.equal(doneAt(0), 0, "au départ");
  assert.equal(doneAt(100), 1, "à l'arrivée");
  assert.equal(doneAt(500), 1, "au-delà de l'arrivée");
}
