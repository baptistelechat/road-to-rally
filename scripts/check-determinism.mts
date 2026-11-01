// Exécute les fichiers de scripts/checks : un `export default` asynchrone qui lève une erreur en cas d'échec.
// Sans argument, tous ; sinon ceux nommés, par exemple `pnpm check:determinism stage geo`.
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SUFFIX = ".check.ts";
const dir = join(dirname(fileURLToPath(import.meta.url)), "checks");
const all = readdirSync(dir)
  .filter((file) => file.endsWith(SUFFIX))
  .sort();

const names = process.argv.slice(2).filter((arg) => arg !== "--");
const files = names.length
  ? all.filter((file) => names.includes(file.slice(0, -SUFFIX.length)))
  : all;

// Un nom mal écrit ne doit pas passer pour une vérification réussie.
const unknown = names.filter((name) => !all.includes(`${name}${SUFFIX}`));
if (unknown.length) {
  console.error(`Vérification inconnue : ${unknown.join(", ")}`);
  console.error(
    `Disponibles : ${all.map((file) => file.slice(0, -SUFFIX.length)).join(", ")}`,
  );
  process.exit(1);
}

let failed = 0;
for (const file of files) {
  try {
    const mod = (await import(pathToFileURL(join(dir, file)).href)) as {
      default: () => Promise<void>;
    };
    await mod.default();
    console.log(`ok   ${file}`);
  } catch (error) {
    failed++;
    console.error(`FAIL ${file}`, error);
  }
}

console.log(`${files.length - failed}/${files.length} vérifications passées`);
process.exit(failed ? 1 : 0);
