# Brand Creator — Road to Rally

> Fichier de suivi du skill brand-creator. Ne pas supprimer avant la fin du workflow.

**Reprendre ici** : ⏸️ pause demandée par Baptiste. Reprendre à l'étape 15 : restituer les tokens shadcn de Nuit facettée (31 couleurs + --brand, clair et sombre, sources dans `docs/design/identity-moodboard.html`, section `.direction-nuit`) pour `src/app/globals.css`, et brancher l'icône (`public/icon.svg`, favicon Next par défaut encore en place). À nettoyer : `docs/design/_check/`. Rien n'est commité.
**Dernière mise à jour** : 2026-11-05
**Légende** : ⬜ à faire · 🔄 en cours · ⏸️ en attente de ta réponse · ✅ fait · ⏭️ ignorée (raison notée)

## Contexte (étape 1)

| Clé              | Valeur                                                                  |
| ---------------- | ----------------------------------------------------------------------- |
| Framework        | Next.js App Router (`src/`)                                             |
| `CSS_FILE`       | `src/app/globals.css` (via `components.json`)                           |
| PWA              | non (Next.js)                                                           |
| Icône principale | Flag (alternatives Gauge, Route) |
| Couleurs projet  | aucune vraie palette : tokens shadcn `neutral` par défaut, fond `neutral-900` |

## Choix validés

| Point d'arrêt                     | Choix | Notes / ajustements |
| --------------------------------- | ----- | ------------------- |
| 1 · Direction UI (étape 5)        | Nuit facettée (v2) | typo Michroma, Manrope, Share Tech Mono ; écrans de jeu ; nuit par défaut |
| 2b · Icône logo                   | Flag (choix par défaut) | alternatives Gauge et Route ; plus tard : logo à partir d'une capture de la voiture |
| 2 · Logo (étape 7)                | R Épingle (icône) + logotype facetté | écran titre = W5 + W6 ; W1 et W7 pour le nom dans le jeu ; coupes prolongées pour traverser les lettres |
| 3 · OG image (étape 11)           | Carte unique (fond scène + grand logo) | jeu = accroche (`src/app/opengraph-image.tsx`) ; tracé = nom, chrono = nom + temps (`/og/stage?name=&time=`, helper `src/lib/ogImage.ts`) ; pas de badge |
| 4 · Écrans à maquetter (étape 18) | —     |                     |

## Étapes

| #     | Étape                        | Statut | Livrable                              |
| ----- | ---------------------------- | ------ | ------------------------------------- |
| 1     | Contexte projet              | ✅     |                                       |
| 2-3   | Paths Lucide + technique SVG | ✅     | lucide-static 1.69.0                  |
| 4     | Moodboard UI                 | ✅     | `docs/design/identity-moodboard.html` (v2), v1 dans `identity-moodboard-v1.html` |
| 5     | ⏸️ Choix direction           | ✅     |                                       |
| 6     | Moodboard logo               | ✅     | `docs/design/logo-creation.html`      |
| 7     | ⏸️ Choix logo                | ✅     |                                       |
| 8     | Export SVG                   | ✅     | `public/icon.svg`, `public/brand/*.svg` |
| 9-10  | Moodboard OG                 | ✅     | `docs/design/og-image-moodboard.html` |
| 11    | ⏸️ Choix OG                  | ✅     |                                       |
| 12    | og:image finale              | ✅     | `src/app/opengraph-image.tsx`, `src/app/og/stage/route.tsx` |
| 13-14 | PWA                          | ⏭️     | projet Next.js, pas Vite              |
| 15    | Tokens CSS                   | ⬜     | bloc pour `src/app/globals.css`       |
| 16    | DESIGN.md + lint             | ⬜     | `docs/design/DESIGN.md`               |
| 17    | Design System Claude         | ⬜     | <url>                                 |
| 18    | ⏸️ Maquettes Claude Design   | ⬜     | <url>                                 |
| 19    | Rapport final                | ⬜     |                                       |

## Sous-tâches

### Étape 4 — Moodboard UI

- [x] Road-book · [x] Livrée tricolore · [x] Carte d'état-major · [x] Facettes · [x] Spéciale de nuit · [x] Terre et paille
- [x] Vérification mécanique (clés, contrastes clair + sombre)
- [x] v2 low-poly : Nuit facettée, Crépuscule, Brouillard d'aube, Neige de nuit, Forêt de nuit, Asphalte mouillé (écran en course, pause, arrivée)

### Étape 6 — Moodboard logo

- [x] A-E (strict) · [x] F-J (dégradé) · [x] K-O (créatif) · [x] P-R (sur-mesure, `logo-design` en mode manuel : pas de Python, scripts de rendu et d'audit non lancés)
- [x] Vérification contrastes icône/fond (20 paires, toutes ≥ 3:1)
- [x] Retour : K « pas mal », Q et R « top » ; demande d'un logotype du nom dans le style de P → `docs/design/logo-wordmark.html` (7 variantes, nom = Road to Rally)
- [ ] Plus tard : logo à partir d'une capture de la voiture du jeu

## Journal

- 2026-11-05 : contexte collecté, moodboard UI généré (6 directions).
- 2026-11-05 : retour Baptiste, v2 générée (6 variations low-poly, typo Spéciale de nuit, écrans de jeu).
- 2026-11-05 : direction Nuit facettée retenue, moodboard logo généré (18 propositions).
- 2026-11-05 : logotype « Road to Rally » facetté (lettres R O A D T L Y en tracés), lockups avec Q et R, écran titre.
- 2026-11-05 : choix fait (Épingle en icône, écran titre W5 + W6, W1 et W7 dans le jeu), coupes corrigées par masque, exports dans public/.
- 2026-11-05 : coupes recalées (bas du R, Y, lacets qui traversent le col), fond low-poly ajouté à l'icône.
- 2026-11-05 : logo validé (montagne agrandie à l'échelle 1,6), moodboard og:image généré (6 templates ogimagecn).
- 2026-11-05 : og:image Logo (jeu) et Photo (spéciale/temps) en Next.js, lint + build OK, rendu vérifié.
- 2026-11-05 : og:image unifiée dans `src/components/og/ShareCard.tsx` (même fond et logo, ligne du bas variable), lint + build OK.
- 2026-11-05 : pause, reprise à l'étape 15.
