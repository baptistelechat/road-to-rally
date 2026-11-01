import assert from "node:assert/strict";
import {
  createGarageMenu,
  ENGINE_ROW,
  GARAGE_ROWS,
  type GarageMenu,
  nearestSwatch,
  RESET_ROW,
  ROTATION_ROW,
  stepGarageMenu,
  SWATCH_COLUMNS,
  SWATCHES,
  validatedEngine,
} from "../../src/app/garage/garageMenu";
import { FLAGS } from "../../src/render/car/flags";
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
  // Réinitialiser les couleurs garde la plaque et le numéro
  const named = { ...onReset, livery: { ...custom, plateText: "AB-123-CD" } };
  assert.deepEqual(stepGarageMenu(named, "confirm").livery, {
    ...defaultLivery,
    plateText: "AB-123-CD",
  });

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

  // Saisie : ouvrir complète à la longueur fixe, les flèches changent le caractère et bouclent
  const numberRow = GARAGE_ROWS.findIndex(
    (r) => r.kind === "text" && r.key === "numberText",
  );
  const typing = stepGarageMenu(start, row(numberRow));
  assert.equal(typing.livery.numberText, "27 ");
  assert.equal(stepGarageMenu(typing, "up").livery.numberText, "37 ");
  const left = stepGarageMenu(typing, "left");
  assert.equal(left.text?.slot, 2);
  assert.equal(stepGarageMenu(left, "up").livery.numberText, "270");
  assert.equal(stepGarageMenu(left, "down").livery.numberText, "279");

  // Le clavier écrit et avance, ignore les caractères interdits, et s'arrête au dernier emplacement
  const typeChar = (menu: GarageMenu, char: string): GarageMenu =>
    stepGarageMenu(menu, { type: "char", char });
  assert.equal(typeChar(typing, "x"), typing);
  const typed = typeChar(typeChar(typeChar(typing, "1"), "2"), "3");
  assert.equal(typed.livery.numberText, "123");
  assert.equal(typed.text?.slot, 2);

  // Retour arrière par-dessus un texte existant : efface ce qui vient d'être tapé, pas la suite
  const overwriting = typeChar(typing, "9");
  assert.equal(overwriting.livery.numberText, "97 ");
  assert.equal(
    stepGarageMenu(overwriting, { type: "erase" }).livery.numberText,
    " 7 ",
  );

  // Retour arrière : efface la dernière case remplie, puis la précédente
  const blank = stepGarageMenu(typed, { type: "erase" });
  assert.equal(blank.livery.numberText, "12 ");
  const erased = stepGarageMenu(blank, { type: "erase" });
  assert.equal(erased.livery.numberText, "1  ");
  assert.equal(erased.text?.slot, 1);

  // Valider retire les espaces de fin, annuler rend le texte d'origine, cliquer ailleurs garde la saisie
  assert.equal(stepGarageMenu(erased, "confirm").livery.numberText, "1");
  assert.equal(stepGarageMenu(erased, "cancel").livery.numberText, "27");
  const kept2 = stepGarageMenu(erased, row(0));
  assert.equal(kept2.livery.numberText, "1");
  assert.equal(kept2.text, null);
  assert.ok(kept2.palette);
  assert.equal(stepGarageMenu(erased, row(numberRow)).text, null);

  // Traverser une ligne de styles ne change rien : il faut l'ouvrir
  const plateRow = GARAGE_ROWS.findIndex(
    (r) => r.kind === "style" && r.key === "plateStyle",
  );
  const onPlate = { ...start, row: plateRow };
  const passedThrough = stepGarageMenu(onPlate, "down");
  assert.equal(passedThrough.row, plateRow + 1);
  assert.equal(passedThrough.livery, start.livery);
  assert.equal(stepGarageMenu(onPlate, "right"), onPlate);

  // Grille ouverte : les quatre directions s'y déplacent et bouclent, sans quitter la ligne
  const picking = stepGarageMenu(onPlate, "confirm");
  assert.equal(picking.livery, start.livery);
  const lower = stepGarageMenu(picking, "down");
  assert.equal(lower.row, plateRow);
  assert.equal(lower.livery.plateStyle, "jaune");
  assert.equal(stepGarageMenu(lower, "right").livery.plateStyle, "rallye");
  assert.equal(stepGarageMenu(lower, "down").livery.plateStyle, "europe");
  assert.equal(stepGarageMenu(picking, "left").livery.plateStyle, "collection");

  // Valider garde le style, annuler rend celui d'origine
  assert.equal(stepGarageMenu(lower, "confirm").livery.plateStyle, "jaune");
  assert.equal(stepGarageMenu(lower, "confirm").picker, null);
  assert.equal(stepGarageMenu(lower, "cancel").livery.plateStyle, "europe");

  // Le clic choisit directement, sans ouvrir la grille
  const clickedStyle = stepGarageMenu(typing, {
    type: "style",
    row: plateRow,
    style: 2,
  });
  assert.equal(clickedStyle.row, plateRow);
  assert.equal(clickedStyle.livery.plateStyle, "jaune");
  assert.equal(clickedStyle.text, null);

  // Drapeau : même grille que les styles, le survol essaie et annuler rend celui d'origine
  const flagRow = GARAGE_ROWS.findIndex(
    (r) => r.kind === "style" && r.key === "flag",
  );
  const brazil = FLAGS.findIndex(({ id }) => id === "BR");
  const flagOpen = stepGarageMenu(start, row(flagRow));
  assert.ok(flagOpen.picker);
  assert.equal(flagOpen.livery.flag, "FR");
  const tried = stepGarageMenu(flagOpen, { type: "try", style: brazil });
  assert.equal(tried.livery.flag, "BR");
  assert.equal(stepGarageMenu(tried, "cancel").livery.flag, "FR");
  assert.equal(stepGarageMenu(tried, "confirm").livery.flag, "BR");
  assert.equal(stepGarageMenu(start, { type: "try", style: brazil }), start);
  const moved = stepGarageMenu(flagOpen, "down");
  assert.equal(moved.row, flagRow);

  // Moteur : le clic choisit et lance la démo, recliquer la relance, et quitter la ligne la coupe.
  const engineStyle = (style: number) =>
    ({ type: "style", row: ENGINE_ROW, style }) as const;
  const heard = stepGarageMenu(start, engineStyle(0));
  assert.equal(heard.livery.engine, "atmo");
  assert.deepEqual(heard.engineDemo, { engine: "atmo" });
  const replayed = stepGarageMenu(heard, engineStyle(0));
  assert.notEqual(replayed.engineDemo, heard.engineDemo);
  assert.equal(stepGarageMenu(heard, "up").engineDemo, null);
  assert.equal(stepGarageMenu(heard, { type: "demoEnd" }).engineDemo, null);
  assert.equal(heard.livery.engine, "atmo");

  // Manette : A joue le moteur actuel, le bas essaie le suivant, B revient au moteur d'origine et coupe la démo.
  const onEngine = { ...start, row: ENGINE_ROW };
  assert.equal(stepGarageMenu(start, "down").engineDemo, null);
  const engineOpen = stepGarageMenu(onEngine, "confirm");
  assert.deepEqual(engineOpen.engineDemo, { engine: "turbo" });
  const nextEngine = stepGarageMenu(engineOpen, "down");
  assert.equal(nextEngine.livery.engine, "five");
  assert.deepEqual(nextEngine.engineDemo, { engine: "five" });
  assert.equal(stepGarageMenu(engineOpen, "left"), engineOpen);
  // La pastille reste sur le moteur d'origine pendant l'essai, et ne passe au nouveau qu'à la validation.
  assert.equal(validatedEngine(nextEngine), "turbo");
  assert.equal(validatedEngine(stepGarageMenu(nextEngine, "confirm")), "five");
  // Une autre grille ouverte ne déplace pas la pastille.
  assert.equal(validatedEngine(flagOpen), flagOpen.livery.engine);
  const engineUndone = stepGarageMenu(nextEngine, "cancel");
  assert.equal(engineUndone.livery.engine, "turbo");
  assert.equal(engineUndone.engineDemo, null);
  // Valider garde le moteur et laisse la démo finir.
  const engineKept = stepGarageMenu(nextEngine, "confirm");
  assert.equal(engineKept.livery.engine, "five");
  assert.equal(engineKept.engineDemo, nextEngine.engineDemo);
  // Réinitialiser les couleurs garde le moteur.
  assert.equal(
    stepGarageMenu({ ...engineKept, row: RESET_ROW }, "confirm").livery.engine,
    "five",
  );

  // La dernière ligne de la grille est incomplète : depuis chaque case, chaque direction mène à une vraie case
  const lastLine = (FLAGS.length - 1) % 7;
  assert.notEqual(lastLine, 6, "ce test suppose une dernière ligne incomplète");
  FLAGS.forEach(({ id }, index) => {
    const at = { ...flagOpen, livery: { ...flagOpen.livery, flag: id } };
    for (const action of ["up", "down", "left", "right"] as const) {
      const target = FLAGS.findIndex(
        (flag) => flag.id === stepGarageMenu(at, action).livery.flag,
      );
      assert.ok(target >= 0, `${action} depuis la case ${index}`);
      assert.notEqual(target, index, `${action} bloqué sur la case ${index}`);
    }
  });
  const flagAt = (index: number) => ({
    ...flagOpen,
    livery: { ...flagOpen.livery, flag: FLAGS[index].id },
  });
  const lastFlag = FLAGS.length - 1;
  // Monter depuis une colonne absente de la dernière ligne s'arrête sur sa dernière case
  assert.equal(stepGarageMenu(flagAt(6), "up").livery.flag, FLAGS[lastFlag].id);
  // Monter depuis une colonne présente reste dans la colonne, redescendre revient en haut
  assert.equal(
    stepGarageMenu(flagAt(0), "up").livery.flag,
    FLAGS[lastFlag - lastLine].id,
  );
  assert.equal(
    stepGarageMenu(flagAt(lastFlag), "down").livery.flag,
    FLAGS[lastLine].id,
  );
  // Gauche et droite bouclent sur les cases réelles de la dernière ligne
  assert.equal(
    stepGarageMenu(flagAt(lastFlag), "right").livery.flag,
    FLAGS[lastFlag - lastLine].id,
  );
  assert.equal(
    stepGarageMenu(flagAt(lastFlag - lastLine), "left").livery.flag,
    FLAGS[lastFlag].id,
  );
  assert.equal(
    FLAGS.findIndex(({ id }) => id === moved.livery.flag),
    FLAGS.findIndex(({ id }) => id === "FR") + 7,
  );
};

export default check;
