@AGENTS.md

## 💻 rally

Jeu de rallye dans le navigateur : le joueur trace une spéciale sur une carte de France, le jeu génère la route en 3D low-poly, il roule au chrono et partage le tracé par lien. Le pilotage prime sur tout le reste. Cadrage dans `docs/prd.md`, découpage dans `docs/roadmap.md` et `docs/stories/`.

### Stack technique

- **Langage** : TypeScript strict
- **Framework** : Next.js 16 (App Router), React 19, le jeu étant chargé côté client sans SSR
- **3D et physique** : Three.js via React Three Fiber et drei, Rapier déterministe (`@dimforge/rapier3d-deterministic-compat`)
- **Runtime / Package manager** : Node.js + pnpm
- **Styling** : Tailwind CSS 4
- **État** : Zustand

### Architecture

`src/sim/` contient la simulation en TypeScript pur, sans React ni rendu, et doit tourner dans Node. `src/render/` affiche l'état sans jamais l'écrire, `src/input/` produit une entrée par pas, `src/game/` assemble le tout. Contrats partagés dans `src/sim/types.ts` et `src/render/carSource.ts`.

### Conventions importantes

- Simulation à pas fixe de 1/60 s : ni `Math.random`, ni horloge dans `src/sim/`.
- Tous les paramètres de la voiture vivent dans `src/sim/carConfig.ts`.
- Avant de la voiture = -Z local, droite = +X, roues dans l'ordre AVG, AVD, ARG, ARD.
- `pnpm check:determinism` lance tous les fichiers `scripts/checks/*.check.ts` (environ 3 min 30) ; `pnpm check:determinism stage geo` ne lance que ceux nommés.
  - **Impératif : aucun check sans l'autorisation explicite de Baptiste**, en entier ou en partie, y compris avant un push ou un merge. Si un check semble nécessaire, lui demander d'abord en disant lequel et pourquoi.
  - Fin de tâche sur le code, `src/sim/` et `src/geo/` compris : `pnpm lint` et `pnpm build`, aucun check.
  - Documentation ou mémoire uniquement : rien.
  - Une seule commande lourde à la fois, jamais pendant que Baptiste joue ou teste, ni en parallèle de navigateurs : son PC a déjà planté.
