# 🔍 Audit initial — Road to Rally

- **Type** : audit
- **Date** : 2026-11-21
- **Étape pipeline** : production (epics 1 à 3 validés, epics 4 et 5 ouverts en même temps)
- **Personas convoquées** : QA Tester, Game Designer, Spécialiste 3C, Technical Artist, Directeur artistique, Sound Designer
- **Non vérifié** : le son (jamais écouté), la manette, le jeu en production (mesures faites en mode dev seulement), un village dense, la carte _Mountain_

## Observations en jeu (✅ mesuré)

Jeu lancé dans le panneau navigateur, mode dev, fenêtre 886 × 638, carte _Road_ courue environ 50 s, console sans erreur.

| Mesure                                          | Valeur                    |
| ----------------------------------------------- | ------------------------- |
| FPS au menu de départ                           | 20                        |
| FPS en course                                   | 31 à 40                   |
| Appels de dessin par image                      | ~100, dont ~75 instanciés |
| Triangles par image (approx., ombres comprises) | ~90 000                   |
| 0 → 68 km/h                                     | ~5 s                      |
| Vitesse à ~40 s pied au plancher                | 153 km/h en 4e            |

Le menu tourne plus lentement que la course (20 contre ~35 FPS). Hypothèse non vérifiée : le flou des cartes du menu par-dessus le canvas.

## Remarques des personas

### 🐞 QA Tester

- ⚠️ 20 stories livrées sans jugement au volant, epics 4 et 5 ouverts en parallèle, alors que la roadmap impose de fermer un epic avant le suivant · P9, P14 · 🟠 · 📖
- ✅ Checklist de non-régression automatisée (`scripts/checks/`), capture `F9`, checks de remise en piste.

### 🧩 Game Designer

- ⚠️ Pas de document de référence unique : règles dans le PRD, la roadmap et ~50 stories ; chiffres dans `carConfig.ts`, `RIG_TUNING`, `simulation.ts`, `recovery.ts` · P2, P5 · 🟠 · 📖
- ⚠️ Pas de surface « rallye » : `Surface = "asphalt" | "grass"` · P1 · 🟠 · 📖
- ✅ Pilotage prouvé avant la géo, comme le prévoyait le PRD (P4).

### 📏 Spécialiste 3C

- ⚠️ Aide aux commandes affichée en course (~30 % de la largeur sur un petit écran), en plus de la mini-carte et du HUD bas (~20 % de la hauteur) · P12, P8 · 🟡 · ✅
- ✅ Valeurs chiffrées et centralisées, caméra qui suit le vecteur vitesse avec seuil à l'arrêt et hauteur min au sol. Accélération conforme à la cible (0-100 en 6-8 s).

### 🛠️ Technical Artist

- ⚠️ Aucune mesure en production ; table de la story 5.6 vide ; critère de l'epic 5 jamais mesuré · P10 · 🟠 · ✅ (dev seulement)
- ✅ Décor découpé en tranches de 200 m, ombres limitées à 80 m, instancing.

### 🎨 Directeur artistique

- ⚠️ Story 5.1 « à faire » alors que 5 ambiances existent (`afternoon`, `morning`, `sunset`, `mist`, `dawn`) : rien n'est verrouillé · P7, P9 · 🟡 · ✅
- ✅ Style low-poly facetté cohérent, brouillard chaud, aucun asset qui jure.

### 🔊 Sound Designer

- ⚠️ Public (3 niveaux de détail) muet · P13 · 🟡 · 📖
- ✅ Moteur synthétisé, pneus, mots de copilote enregistrés.

## Propositions et décisions

| PR   | Titre                                        | Persona       | Options                                                                         | Reco     | Décision                                                                                                                                                                                              |
| ---- | -------------------------------------------- | ------------- | ------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PR-1 | Fermer l'epic 4 avant tout nouveau code      | QA            | A : playtest dédié à l'epic 4 · B : epics 4 et 5 ensemble                       | A        | ✅ **A**                                                                                                                                                                                              |
| PR-2 | Écrire `docs/gamedev/GDD.md`                 | Game Designer | A : GDD court reconstruit depuis PRD, roadmap, code · B : rien                  | A        | ✅ **A**                                                                                                                                                                                              |
| PR-3 | Mesurer le critère de l'epic 5 en production | Tech Artist   | A : `build` + `start`, village, lancé par Baptiste · B : hook de debug          | A        | ✅ **A**, à faire au moment de fermer l'epic 5, donc après PR-1                                                                                                                                       |
| PR-4 | Surface de rallye                            | Game Designer | A : type `gravel` complet · B : bas-côtés en gravier · C : reporter et l'écrire | C puis B | ✅ **C puis B** : bas-côtés en gravier dans un second temps, puis d'autres surfaces à adhérence variée plus tard                                                                                      |
| PR-5 | L'aide aux commandes s'efface                | 3C            | A : après premier usage · B : menu pause seulement                              | B        | ❌ **rejetée** : l'option `controlsHelpEnabled` existe déjà dans les options, Baptiste veut l'aide à l'écran tant qu'elle est activée. À repenser avec la version téléphone et ses commandes tactiles |

⏸️ **En attente** (pour enrichir le jeu, à reprendre dans un prochain audit) : verrouiller l'ambiance par défaut (5.1), son du public, longue ligne droite d'ouverture de _Road_ (50 s sans note ni chicane observée).

## Références

- **Art of Rally** (2020, PC et consoles) : comparer le comportement de la même voiture sur terre et sur asphalte, et ce que la poussière et le son racontent. Liée à PR-4. Pas de spéciale précise citée.

## Tests manuels

| Test                                                 | Lié à      | Ressenti de Baptiste           | Ce que ça tranche                                        |
| ---------------------------------------------------- | ---------- | ------------------------------ | -------------------------------------------------------- |
| T-1 · Sensation de vitesse à 150 km/h, vue poursuite | 3C         | « juste »                      | Caméra et FOV gardés tels quels                          |
| T-2 · Ouverture de _Road_, 60 s pied au plancher | PR-6 | « c'est une route de test, mais c'est ennuyeux. Ça montre une grosse accélération, il faut des décors sur les bas-côtés, des chicanes » | Ouvre PR-6 |
| T-3 · Aide aux commandes regardée après 2 courses    | PR-5       | « non »                        | L'option existante suffit, rien ne change pour l'instant |

## Tour 2 — 2026-11-21

Retours de Baptiste sur T-2 et sur les ❓ du GDD.

### 🗺️ Level Designer
- ⚠️ `road` et `mountain` datent de la version 6 du pipeline (01/11), on est à la 21. `scripts/bake-stage.ts` n'applique ni le décor BD TOPO ni les chicanes automatiques : les deux cartes de vitrine montrent le jeu d'il y a trois semaines · P1, P4 · 🟠 · 📖
- ✅ La ligne droite de `road` sert bien à sentir l'accélération (ressenti de Baptiste).

### 🔊 Sound Designer — fiche du public (PR-8)
- Ambiance : un murmure par groupe de spectateurs, spatialisé, audible à moins de ~80 m. Seuls les 3 groupes les plus proches jouent.
- Passage : la clameur monte quand la voiture passe, plus fort si elle passe vite ou en glisse : le public récompense le pilotage (P12).
- Événements : cris d'inquiétude sur un choc ou une sortie près d'eux, cornes et applaudissements au départ et à l'arrivée.
- 3 à 4 variantes par son, hauteur et volume tirés au hasard côté rendu seulement : la simulation ne lit jamais l'audio.

### Propositions

| PR | Titre | Persona | Options | Reco | Décision |
| --- | --- | --- | --- | --- | --- |
| PR-6 | Réveiller l'ouverture de `road` | Level Designer | A : rebaker `road` et `mountain` avec décor et chicanes · B : habiller la ligne droite (zone de départ avec public, une chicane à mi-parcours, panneaux de distance avant le premier virage) · C : remplacer `road` par une route plus sinueuse | A puis B | ✅ **A et B, à faire tout de suite** ; B s'applique à toutes les nouvelles générations. Panneaux : **B · Chevrons rallye** ([visuel](../visuels/PR-6-panneaux-distance.html)) |
| PR-7 | Page téléphone en vocabulaire rallye | Directeur artistique | A : parc fermé · B : carton de pointage · C : feux de départ ([visuel](../visuels/PR-7-page-telephone.html)) | B | ✅ **A · Parc fermé**, avec le nom de la spéciale et le temps à battre du défi |
| PR-8 | Son du public | Sound Designer | A : synthèse Web Audio · B : échantillons libres de droits (CC0) · C : ambiance synthétisée + échantillons de cris et cornes | B | ✅ **B · échantillons CC0**, avec la fiche telle quelle : murmure par groupe à moins de ~80 m (3 groupes max), clameur au passage plus forte vite ou en glisse, cris sur un choc ou une sortie proche, cornes et applaudissements au départ et à l'arrivée, 3 à 4 variantes par son, aucun effet sur la simulation |
| PR-9 | Ambiance par défaut | Directeur artistique | `afternoon` | — | ✅ **`afternoon`**, décidé par Baptiste |

## Tour 3 — 2026-11-21

Captures de Baptiste sur `mountain` régénérée (décor IGN, version 21).

### 🐞 QA Tester
- B-1 · public et barrières des épingles perchés sur le versant · P1 · majeur · 🧑 · voir `BUGS.md` · correctif validé : objets seulement, la végétation reste sur le versant
- B-2 · arche de secteur dans le talus et dans le vide · P1, P8 · majeur · 🧑 · voir `BUGS.md`
- ✅ La régénération rend enfin le relief et le décor réels : la montagne se lit comme une montagne.

### 🎨 Directeur artistique + 🗺️ Level Designer
- On garde l'arche ; il faut une alternative quand la route est étroite (demande de Baptiste).

| PR | Titre | Persona | Options | Reco | Décision |
| --- | --- | --- | --- | --- | --- |
| PR-10 | Arche sur route étroite | DA + Level Designer | A : pieds ajustés au terrain · B : potence côté talus · C : banderole sur deux mâts ([visuel](../visuels/PR-10-arche-route-etroite.html)) | A par défaut, B quand un pied ne trouve pas le sol à moins de ~3 m | ✅ **A par défaut, C quand un pied ne trouve pas le sol** (route étroite) ; B (potence) écartée. B-2 à retester après correctif |

## Statut

planifié → [PLAN-audit-2026-11-21](../plans/PLAN-audit-2026-11-21.md)
