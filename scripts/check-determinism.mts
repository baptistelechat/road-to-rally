// Exécute chaque fichier de scripts/checks : un `export default` asynchrone qui lève une erreur en cas d'échec.
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "checks");
const files = readdirSync(dir)
  .filter((file) => file.endsWith(".check.ts"))
  .sort();

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
