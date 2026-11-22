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

| Test                                                 | Lié à | Ressenti de Baptiste                                                                                                                      | Ce que ça tranche                                        |
| ---------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| T-1 · Sensation de vitesse à 150 km/h, vue poursuite | 3C    | « juste »                                                                                                                                 | Caméra et FOV gardés tels quels                          |
| T-2 · Ouverture de _Road_, 60 s pied au plancher     | PR-6  | « c'est une route de test, mais c'est ennuyeux. Ça montre une grosse accélération, il faut des décors sur les bas-côtés, des chicanes »   | Ouvre PR-6                                               |
| T-3 · Aide aux commandes regardée après 2 courses    | PR-5  | « non »                                                                                                                                   | L'option existante suffit, rien ne change pour l'instant |
| T-4 · `road` après PR-6 (décor, chicanes, panneaux)  | PR-6  | décor « oui », chicanes « juste », panneaux vus comme alerte de virage fort plutôt que repère de freinage, « plutôt bien », ennui « non » | Étape 9 remplie sur `road`, panneaux gardés              |

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

| PR   | Titre                                | Persona              | Options                                                                                                                                                                                                                                         | Reco     | Décision                                                                                                                                                                                                                                                                                                           |
| ---- | ------------------------------------ | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PR-6 | Réveiller l'ouverture de `road`      | Level Designer       | A : rebaker `road` et `mountain` avec décor et chicanes · B : habiller la ligne droite (zone de départ avec public, une chicane à mi-parcours, panneaux de distance avant le premier virage) · C : remplacer `road` par une route plus sinueuse | A puis B | ✅ **A et B, à faire tout de suite** ; B s'applique à toutes les nouvelles générations. Panneaux : **B · Chevrons rallye** ([visuel](../visuels/PR-6-panneaux-distance.html))                                                                                                                                      |
| PR-7 | Page téléphone en vocabulaire rallye | Directeur artistique | A : parc fermé · B : carton de pointage · C : feux de départ ([visuel](../visuels/PR-7-page-telephone.html))                                                                                                                                    | B        | ✅ **A · Parc fermé**, avec le nom de la spéciale et le temps à battre du défi                                                                                                                                                                                                                                     |
| PR-8 | Son du public                        | Sound Designer       | A : synthèse Web Audio · B : échantillons libres de droits (CC0) · C : ambiance synthétisée + échantillons de cris et cornes                                                                                                                    | B        | ✅ **B · échantillons CC0**, avec la fiche telle quelle : murmure par groupe à moins de ~80 m (3 groupes max), clameur au passage plus forte vite ou en glisse, cris sur un choc ou une sortie proche, cornes et applaudissements au départ et à l'arrivée, 3 à 4 variantes par son, aucun effet sur la simulation |
| PR-9 | Ambiance par défaut                  | Directeur artistique | `afternoon`                                                                                                                                                                                                                                     | —        | ✅ **`afternoon`**, décidé par Baptiste                                                                                                                                                                                                                                                                            |

## Tour 3 — 2026-11-21

Captures de Baptiste sur `mountain` régénérée (décor IGN, version 21).

### 🐞 QA Tester

- B-1 · public et barrières des épingles perchés sur le versant · P1 · majeur · 🧑 · voir `BUGS.md` · correctif validé : objets seulement, la végétation reste sur le versant
- B-2 · arche de secteur dans le talus et dans le vide · P1, P8 · majeur · 🧑 · voir `BUGS.md`
- ✅ La régénération rend enfin le relief et le décor réels : la montagne se lit comme une montagne.

### 🎨 Directeur artistique + 🗺️ Level Designer

- On garde l'arche ; il faut une alternative quand la route est étroite (demande de Baptiste).

| PR    | Titre                   | Persona             | Options                                                                                                                                   | Reco                                                               | Décision                                                                                                                        |
| ----- | ----------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| PR-10 | Arche sur route étroite | DA + Level Designer | A : pieds ajustés au terrain · B : potence côté talus · C : banderole sur deux mâts ([visuel](../visuels/PR-10-arche-route-etroite.html)) | A par défaut, B quand un pied ne trouve pas le sol à moins de ~3 m | ✅ **A par défaut, C quand un pied ne trouve pas le sol** (route étroite) ; B (potence) écartée. B-2 à retester après correctif |

## Tour 4 — 2026-11-21 · consultation 3C sur les annonces

Retour de Baptiste après T-4 : « à haute vitesse les chicanes ne sont pas annoncées assez tôt… je pense que la vitesse n'est pas prise en compte dans les annonces des virages, uniquement la distance ».

**🎮 3C** — La vitesse est bien prise en compte : une phrase part à `vitesse × (durée + ANTICIPATION)` du virage (`src/sim/paceNoteCue.ts`, story 4.8). Le défaut est ailleurs : la marge `ANTICIPATION` vaut 1 s fixe, alors que la distance de freinage grandit avec le carré de la vitesse. À 150 km/h, la phrase finit ~42 m avant la chicane, il en faudrait ~80 pour freiner (📖 déduit, décélération estimée à ~9 m/s², non mesurée). Les chicanes souffrent le plus car elles coupent les lignes droites les plus longues, donc les plus rapides.
  - ⚠️ Note finie après le point de freinage à haute vitesse · viole P6 et P12 · gravité 🟠 important · source 🧑 ressenti + 📖 déduit → B-4
  - ✅ Le planning à rebours (8 annonces) et la version courte en cas de retard sont solides

| PR | Titre | Persona | Options | Recommandation | Décision |
| --- | --- | --- | --- | --- | --- |
| PR-11 | Annonce finie avant le freinage | 3C | A : `ANTICIPATION` de 1 à 2 s · B : marge = 1 s + temps de freinage jusqu'à la vitesse de la note (vitesse cible par sévérité) · C : marge = 1 s + vitesse ÷ (2 × décélération) | C | ✅ **C** (2026-11-21) → étape 14 du plan |

### Tour 4 bis — remarque de Baptiste sur les chocs

« Il y a une logique d'antiretournement : lors d'un choc (sur une chicane par exemple), la voiture semble rester collée à la route. Le choc n'est pas naturel. »

**🎮 3C** — Trois aides de `applyAssists` (`src/sim/vehicle.ts`) agissent à pleine force à chaque pas, y compris pendant un choc et en l'air : l'anti-tonneau (0,5, redresse dès 10° d'inclinaison), la limite de lacet (2,2 rad/s, freine net la rotation que donne un impact) et le rappel de glisse (16). Le code mesure déjà la violence d'un choc (`impact`, de 0 à 1, qui retombe en ~0,3 s), mais ne s'en sert pas pour relâcher ces aides. C'est cohérent avec ton ressenti : l'impact est absorbé au lieu d'envoyer la voiture valser.
  - ⚠️ Choc gommé par les aides · viole P6 et P12 · gravité 🟠 important · source 🧑 ressenti + 📖 déduit
  - ✅ Les aides font leur travail en conduite normale : glisse lisible, pas de toupie (T-1 « juste »)

**🧪 QA** — Toucher à `vehicle.ts` change la physique : les records et les fantômes enregistrés avant le changement risquent de ne plus coller (📖 à vérifier dans le format du fantôme). Il faudra un `check:determinism`, avec ton accord.

| PR | Titre | Persona | Options | Recommandation | Décision |
| --- | --- | --- | --- | --- | --- |
| PR-12 | Laisser vivre les chocs | 3C | A : baisser les aides partout · B : relâcher les trois aides selon `impact` (forces × (1 − impact)), elles reviennent d'elles-mêmes en ~0,3 s · C : B + couper l'anti-tonneau en l'air, quitte à accepter un vrai tonneau, rattrapé par la remise en piste (+5 s) | B | ✅ **C ✏️ étendue** (2026-11-21) : en plus de B, l'anti-tonneau **et** le rappel de glisse coupés dès qu'aucune roue ne touche, sauts et chutes dans un ravin compris (`mountain` : la voiture « plane » en tombant dans le vide) → étape 15 du plan |

T-5 répondu : tonneau possible → option C.

### Tour 5 — 2026-11-21 · retours en jeu

- Chute dans un ravin sur `mountain` : « la voiture plane quand elle chute dans le vide ». **🎮 3C** : gravité normale (9,81), mais l'anti-tonneau redresse aussi le tangage, donc la caisse tombe parfaitement à plat, comme un planeur (📖 déduit). Rattaché à PR-12, étendue.
- `Le Mans` (spéciale de l'éditeur) : « le pont est caché à la fin de la spéciale », précisé ensuite : pas enterré, « la courbe du pont est mal gérée, on dirait des cordes qui traversent la route ». **🧪 QA** : cause trouvée, les lisses sont une seule poutre droite d'un bout à l'autre du pont (📖, confirmé par 2 captures de 19:14) → B-5, étape 16.
- Fantômes : Baptiste décide de supprimer les anciens fantômes plutôt que de les rendre compatibles avec la nouvelle physique (on est en dev).
- Capture du 21/11 à 19:07 : message « La création des collisions a figé l'écran 0,9 s », moniteur à 50 FPS (min 7) → B-6.

### Tour 6 — 2026-11-21 · retest et nouvelles remarques

- Retest : B-1, B-2, B-5 « ok » ; B-4 « parfait l'annonce » ; chutes dans le vide « ok » ; chocs frontaux pas encore : « le choc est net et la voiture ne se soulève pas au choc, elle recule juste ». Correctif : un coup de tangage proportionnel au choc, comme si l'impact portait 0,25 m sous le centre de gravité (`IMPACT_LIFT_ARM`, `vehicle.ts`). Retesté : « ok pour le choc ».
- Troncs blancs : bouleaux (essence IGN, écorce blanche), « on touche à rien ».
- Ombres : « elles apparaissent en avançant, l'apparition saccade ». **🎨 Lighting** : la zone d'ombre fait 45 m de demi-côté autour de la voiture (`Atmosphere.tsx`) et le décor à plus de 40 m de la route n'en a jamais : chaque ombre surgit d'un coup au bord de la zone · viole P12 · 🟡 mineur · 🧑 + 📖.
- Ronds-points : la barrière fait corps avec l'îlot fixe. Baptiste : « au lieu de faire des barrières autour des ronds-points, créer d'autres objets, fais-moi des propositions (plot, élément béton…) ».

| PR | Titre | Persona | Options | Recommandation | Décision |
| --- | --- | --- | --- | --- | --- |
| PR-13 | Ce qui entoure l'îlot de rond-point | Level Designer + DA | A : piles de pneus · B : séparateurs plastique lestés · C : bottes de paille existantes · D : blocs béton fixes ([visuel](../visuels/PR-13-ilot-rond-point.html)) ; îlot solide dans tous les cas | A | ✅ **B · séparateurs plastique** (2026-11-21) → étape 18 du plan |
| PR-14 | Ombres sans apparition brutale | Lighting Artist | A : zone de 45 à 80 m, carte 4096 · B : ombres en cascade (CSM), nettes près et grossières loin · C : ombre qui s'estompe au bord de la zone | A, puis B si l'apparition reste visible ; FPS à mesurer (P10) | ✅ **A** (2026-11-21, corrigé : « uniquement b » visait PR-13) : zone de 80 m, carte 4096 → étape 17 du plan |

### Tour 7 — 2026-11-21 · îlots, obstacles fixes, ombres

- Îlots : séparateurs « parfait » ; butte à arrondir ; « deux réactions au choc pour les barrières, c'est pas logique » → plus aucune barrière fixe autour d'un îlot. Puis : « les dômes simples ne sont pas très jolis ».
- Obstacles fixes (blocs de chicane, terre-pleins) : Baptiste veut garder des obstacles fixes avec un autre aspect, propositions dans le labo (`/decor-lab?tab=obstacles`).
- Ombres : « encore des lags sur l'apparition » → B-8.
- Annonces : départ en virage annoncé, et voix pendant le décompte → B-7.

| PR | Titre | Persona | Options | Recommandation | Décision |
| --- | --- | --- | --- | --- | --- |
| PR-15 | Aspect des obstacles fixes (chicanes, terre-pleins) | DA + Level Designer | A : béton profilé · B : glissière métallique · C : mur de pneus cerclé · D : gabions (labo, onglet Obstacles) | A pour les chicanes et B pour les terre-pleins : deux codes routiers que tout le monde lit comme fixes | ✅ **B devant les chicanes, A sur les terre-pleins** (2026-11-21) → étape 19 |
| PR-16 | Petit îlot de rond-point solide | DA | 1 : jardinière béton · 2 : îlot pavé et panneau giratoire · 3 : pelouse et arbre · 4 : rochers (labo, onglet Obstacles, avec le dôme actuel pour comparer) | 3, la même butte basse servant aussi de cœur aux grands îlots | ✅ **1 et 4 au hasard** (2026-11-21), pour tous les îlots → étape 19 |

## Statut

planifié → [PLAN-audit-2026-11-21](../plans/PLAN-audit-2026-11-21.md)
