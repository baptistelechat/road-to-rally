// Copie dans `public/input/` les icônes listées par `src/input/inputPrompts.ts`, et seulement elles.
// `pnpm icons:sync` écrit ; `pnpm icons:sync --check` compare sans rien toucher et échoue si c'est en retard.
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
  ICON_SOURCES,
  iconsOf,
  PROMPT_DEVICES,
} from "../src/input/inputPrompts";

const ROOT = join(import.meta.dirname, "..");
const SOURCE_ROOT = join(ROOT, "assets-src", "kenney-input");
const TARGET_ROOT = join(ROOT, "public", "input");
const check = process.argv.includes("--check");

const svgNames = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((file) => file.endsWith(".svg"))
        .map((file) => file.slice(0, -4))
    : [];

const distance = (a: string, b: string): number => {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++)
      next[j] = Math.min(
        row[j] + 1,
        next[j - 1] + 1,
        row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    row = next;
  }
  return row[b.length];
};

const closest = (name: string, candidates: string[]): string[] =>
  candidates
    .map((candidate) => ({ candidate, d: distance(name, candidate) }))
    .sort((x, y) => x.d - y.d)
    .slice(0, 3)
    .map(({ candidate }) => candidate);

const errors: string[] = [];
const stale: string[] = [];
let added = 0;
let removed = 0;
let unchanged = 0;

for (const device of PROMPT_DEVICES) {
  const sourceDir = join(SOURCE_ROOT, ICON_SOURCES[device]);
  const targetDir = join(TARGET_ROOT, device);
  const available = svgNames(sourceDir);
  const wanted = iconsOf(device);

  for (const name of wanted) {
    if (!available.includes(name)) {
      errors.push(
        `${device} : « ${name} » introuvable dans ${ICON_SOURCES[device]}. Proches : ${closest(name, available).join(", ")}`,
      );
      continue;
    }
    const content = readFileSync(join(sourceDir, `${name}.svg`));
    const targetFile = join(targetDir, `${name}.svg`);
    if (existsSync(targetFile) && readFileSync(targetFile).equals(content)) {
      unchanged++;
      continue;
    }
    if (check) stale.push(`${device}/${name}.svg à copier`);
    else {
      mkdirSync(targetDir, { recursive: true });
      writeFileSync(targetFile, content);
    }
    added++;
  }

  for (const name of svgNames(targetDir)) {
    if (wanted.includes(name)) continue;
    if (check) stale.push(`${device}/${name}.svg à supprimer`);
    else rmSync(join(targetDir, `${name}.svg`));
    removed++;
  }
}

if (errors.length > 0) {
  console.error(
    `icons:sync : ${errors.length} icône(s) inconnue(s)\n  ${errors.join("\n  ")}`,
  );
  process.exit(1);
}
if (check && stale.length > 0) {
  console.error(
    `icons:sync : public/input/ n'est pas à jour, lancer \`pnpm icons:sync\`\n  ${stale.join("\n  ")}`,
  );
  process.exit(1);
}
console.log(
  check
    ? `icons:sync : à jour (${unchanged} icônes)`
    : `icons:sync : +${added} ajoutée(s), -${removed} supprimée(s), ${unchanged} inchangée(s)`,
);
