import assert from "node:assert/strict";
import {
  createGarageMenu,
  nearestSwatch,
  RESET_ROW,
  ROTATION_ROW,
  stepGarageMenu,
  SWATCH_COLUMNS,
  SWATCHES,
} from "../../src/app/garage/garageMenu";
import { defaultLivery } from "../../src/render/car/livery";

const check = async (): Promise<void> => {
  const custom = { ...defaultLivery, primary: SWATCHES[12].hex };
  const start = createGarageMenu(custom);

  // Palette : 20 teintes de 11 nuances, toutes distinctes (clé React) et stockables
  assert.equal(SWATCHES.length, 220);
  assert.equal(new Set(SWATCHES.map(({ hex }) => hex)).size, SWATCHES.length);
  assert.ok(SWATCHES.every(({ hex }) => /^#[0-9a-f]{6}$/.test(hex)));
  assert.equal(SWATCHES[nearestSwatch("#fb2c35")].name, "red-500");

  // Navigation : boucle sur les lignes, gauche et annuler ne font rien hors palette
  const top = stepGarageMenu(start, "up");
  assert.equal(top.row, ROTATION_ROW);
  assert.equal(stepGarageMenu(top, "down").row, 0);
  assert.equal(stepGarageMenu(start, "left"), start);
  assert.equal(stepGarageMenu(start, "cancel"), start);

  // Valider n'agit que sur la ligne sélectionnée : la rotation n'a pas d'autre raccourci
  assert.equal(stepGarageMenu(start, "confirm").paused, false);
  assert.equal(stepGarageMenu(top, "confirm").paused, true);
  const onReset = { ...start, row: RESET_ROW };
  assert.equal(stepGarageMenu(onReset, "confirm").livery, defaultLivery);

  // Palette : ouvrir ne change rien, chaque déplacement applique la couleur
  const opened = stepGarageMenu(start, "confirm");
  assert.equal(opened.livery, custom);
  assert.deepEqual(opened.palette, { swatch: 12, original: SWATCHES[12].hex });
  const right = stepGarageMenu(opened, "right");
  assert.equal(right.livery.primary, SWATCHES[13].hex);
  const down = stepGarageMenu(opened, "down");
  assert.equal(down.palette?.swatch, 12 + SWATCH_COLUMNS);

  // Les bords bouclent sur la même ligne et la même colonne
  const corner = stepGarageMenu(opened, { type: "hover", swatch: 0 });
  const last = SWATCH_COLUMNS - 1;
  assert.equal(stepGarageMenu(corner, "left").palette?.swatch, last);
  assert.equal(
    stepGarageMenu(corner, "up").palette?.swatch,
    SWATCHES.length - SWATCH_COLUMNS,
  );

  // Valider garde la couleur, annuler rend celle d'origine
  const kept = stepGarageMenu(right, "confirm");
  assert.equal(kept.palette, null);
  assert.equal(kept.livery.primary, SWATCHES[13].hex);
  const undone = stepGarageMenu(right, "cancel");
  assert.equal(undone.palette, null);
  assert.equal(undone.livery.primary, SWATCHES[12].hex);

  // Souris : même chemin, survoler essaie, cliquer valide
  const row = (index: number) => ({ type: "row", row: index }) as const;
  const clicked = stepGarageMenu(start, row(2));
  assert.equal(clicked.row, 2);
  assert.ok(clicked.palette);
  const hovered = stepGarageMenu(clicked, { type: "hover", swatch: 5 });
  assert.equal(hovered.livery.accent, SWATCHES[5].hex);
  const picked = stepGarageMenu(hovered, { type: "pick", swatch: 7 });
  assert.equal(picked.palette, null);
  assert.equal(picked.livery.accent, SWATCHES[7].hex);

  // Recliquer la ligne annule, cliquer une autre ligne annule puis l'ouvre
  const closed = stepGarageMenu(hovered, row(2));
  assert.equal(closed.palette, null);
  assert.equal(closed.livery.accent, custom.accent);
  const other = stepGarageMenu(hovered, row(3));
  assert.equal(other.row, 3);
  assert.ok(other.palette);
  assert.equal(other.livery.accent, custom.accent);

  // Le bouton de rotation passe par le même chemin
  assert.equal(stepGarageMenu(hovered, row(ROTATION_ROW)).paused, true);
};

export default check;
