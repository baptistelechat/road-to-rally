// Copie le worker de MapLibre du paquet installé vers `public/vendor/` : servi par notre site, plus par unpkg, et toujours à la version installée.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const dist = dirname(require.resolve("maplibre-gl/dist/maplibre-gl-worker.mjs"));
const target = join(process.cwd(), "public", "vendor");
mkdirSync(target, { recursive: true });
copyFileSync(
  join(dist, "maplibre-gl-worker.mjs"),
  join(target, "maplibre-gl-worker.mjs"),
);
