---
id: ZBLK-001
type: blocker
date: 2026-10-31
summary: "tsx refuse le top-level await dans un script .ts"
tags: [tsx, esbuild, top-level-await, esm, cjs, scripts]
status: résolu
---

# BLK-001 — tsx refuse le top-level await dans un script .ts

**Friction** : `pnpm check:determinism` plantait avec une `TransformError` esbuild au lancement de `scripts/check-determinism.ts`.

**Cause réelle** : Sans `"type": "module"` dans `package.json`, tsx traite un fichier `.ts` en CommonJS, où le `await` de haut niveau n'existe pas.

**Solution** : Renommer le point d'entrée en `.mts`. Les fichiers `*.check.ts` importés restent en `.ts` car ils n'utilisent pas de `await` de haut niveau.
