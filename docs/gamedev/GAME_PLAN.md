# 🎮 Game Plan — Road to Rally

## 📍 Où on en est

Audit initial du 2026-11-21 terminé et planifié. [PLAN-audit-2026-11-21](plans/PLAN-audit-2026-11-21.md) validé le 2026-11-21. Tour 2 décidé : PR-6, PR-7 et PR-8 validées et ajoutées au plan (étapes 9 à 11). Panneaux : B · Chevrons rallye. Étape 9 : code livré (panneaux dans la simulation, décor et chicanes dans `bake-stage`), lint et build OK, `road` (4 chicanes) et `mountain` régénérées en version 21 avec décor IGN le 2026-11-21. GDD validé. T-4 fait le 2026-11-21 : `road` jugée au volant, ouverture plus ennuyeuse, mais annonces trop tardives à haute vitesse (B-4) : PR-11 validée en C (étape 14 du plan). Chocs gommés par les aides : PR-12 validée en C étendue (étape 15). Nouveaux bugs : B-5 (lisses de pont en travers de la route dans les courbes, étape 16) et B-6 (gel de 0,9 s). Étapes 9 et 12 à 19 codées, testées et cochées le 2026-11-21 ; étapes 12 à 16 codées le 2026-11-21 (lint et build OK), anciens fantômes ignorés (format v3). Retest du 2026-11-21 : B-1, B-2, B-5 vérifiés ; B-4 vérifié ; chutes OK, chocs frontaux OK après le coup de tangage. PR-14 validée en A (étape 17) et PR-13 en B (étape 18), toutes deux codées le 2026-11-21. `road` et `mountain` rebakées en version 23 le 2026-11-21. **2026-11-22** : parcours A du playtest de l'epic 4 terminé (A1 à A13 ✅). Nouveaux : B-11 (moteur muet au départ, étape 20), B-12 (arche dans le terre-plein, étape 21), B-13 (creux sous les ponts dans le profil), B-14 (rond-point plat sur route en pente) ; PR-20 validée (étape 22, après B-14). Ensuite : parcours B, C, D, puis T-6 (tunnels) et le retest de B-3 ; étapes 6, 10, 11 et B-6 plus tard.

## Principes en vigueur sur ce projet

Le [GDD](GDD.md) est la seule source des métriques et de la bible :

- Voiture et métriques 3C : [GDD § 4 à 6](GDD.md#4-voiture-caractère)
- Règles de course : [GDD § 7](GDD.md#7-règles-de-course)
- Surfaces : [GDD § 9](GDD.md#9-surfaces)
- Bible visuelle : [GDD § 10](GDD.md#10-bible-visuelle)
- Budget de performance : [GDD § 12](GDD.md#12-budget-de-performance)

## Décisions

| Date       | PR    | Titre                                        | Persona              | Décision                                                                                                                 | Origine                                                       |
| ---------- | ----- | -------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| 2026-11-21 | PR-1  | Fermer l'epic 4 avant tout nouveau code      | QA                   | ✅ A : playtest dédié à l'epic 4                                                                                         | [audit](audits/AUDIT-2026-11-21-audit-initial.md)             |
| 2026-11-21 | PR-2  | Écrire le GDD                                | Game Designer        | ✅ A : GDD court reconstruit                                                                                             | [audit](audits/AUDIT-2026-11-21-audit-initial.md)             |
| 2026-11-21 | PR-3  | Mesurer le critère de l'epic 5 en production | Tech Artist          | ✅ A, au moment de fermer l'epic 5 (après PR-1)                                                                          | [audit](audits/AUDIT-2026-11-21-audit-initial.md)             |
| 2026-11-21 | PR-4  | Surface de rallye                            | Game Designer        | ✅ C puis B : rien en v0, bas-côtés en gravier ensuite, d'autres surfaces à adhérence variée plus tard                   | [audit](audits/AUDIT-2026-11-21-audit-initial.md)             |
| 2026-11-21 | PR-5  | L'aide aux commandes s'efface                | 3C                   | ❌ rejetée : l'option `controlsHelpEnabled` existe déjà ; à repenser avec la version téléphone et ses commandes tactiles | [audit](audits/AUDIT-2026-11-21-audit-initial.md)             |
| 2026-11-21 | PR-6  | Réveiller l'ouverture de `road`              | Level Designer       | ✅ A et B tout de suite, B sur toutes les générations, panneaux B · Chevrons rallye                                      | [audit](audits/AUDIT-2026-11-21-audit-initial.md)             |
| 2026-11-21 | PR-7  | Page téléphone en vocabulaire rallye         | Directeur artistique | ✅ A · Parc fermé, avec le nom et le temps du défi                                                                       | [audit](audits/AUDIT-2026-11-21-audit-initial.md)             |
| 2026-11-21 | PR-8  | Son du public                                | Sound Designer       | ✅ B · échantillons CC0, fiche du tour 2                                                                                 | [audit](audits/AUDIT-2026-11-21-audit-initial.md)             |
| 2026-11-21 | PR-9  | Ambiance par défaut                          | Directeur artistique | ✅ `afternoon`                                                                                                           | [audit](audits/AUDIT-2026-11-21-audit-initial.md)             |
| 2026-11-21 | PR-10 | Arche sur route étroite                      | DA + Level Designer  | ✅ A par défaut, C sur route étroite                                                                                     | [audit](audits/AUDIT-2026-11-21-audit-initial.md)             |
| 2026-11-21 | PR-11 | Annonce finie avant le freinage              | 3C                   | ✅ C : marge = 1 s + vitesse ÷ (2 × décélération)                                                                        | [audit, tour 4](audits/AUDIT-2026-11-21-audit-initial.md)     |
| 2026-11-21 | PR-12 | Laisser vivre les chocs                      | 3C                   | ✅ C étendue : aides relâchées selon `impact`, anti-tonneau et rappel de glisse coupés en l'air (sauts, ravins)          | [audit, tour 4 bis](audits/AUDIT-2026-11-21-audit-initial.md) |
| 2026-11-21 | PR-13 | Ce qui entoure l'îlot de rond-point          | Level Designer + DA  | ✅ B : séparateurs plastique lestés, renversables, autour d'une butte solide                                             | [audit, tour 6](audits/AUDIT-2026-11-21-audit-initial.md)     |
| 2026-11-21 | PR-14 | Ombres sans apparition brutale               | Lighting Artist      | ✅ A : zone d'ombre de 80 m, carte 4096 (corrigé le même jour : « uniquement b » visait PR-13)                           | [audit, tour 6](audits/AUDIT-2026-11-21-audit-initial.md)     |
| 2026-11-21 | PR-15 | Aspect des obstacles fixes                   | DA + Level Designer  | ✅ glissière métallique devant les chicanes, béton profilé sur les terre-pleins                                          | [audit, tour 7](audits/AUDIT-2026-11-21-audit-initial.md)     |
| 2026-11-21 | PR-16 | Cœur solide des îlots                        | DA                   | ✅ jardinière béton ou rochers, au hasard d'un îlot à l'autre                                                            | [audit, tour 7](audits/AUDIT-2026-11-21-audit-initial.md)     |
| 2026-11-22 | PR-17 | Moteur qui monte pendant le décompte | Sound Designer + 3C | ✅ A : son seul, simulation intacte | [audit, tour 8](audits/AUDIT-2026-11-21-audit-initial.md) |
| 2026-11-22 | PR-19 | Arche sur route à terre-plein | Level Designer + DA | ✅ B, et C quand la place manque | [audit, tour 8](audits/AUDIT-2026-11-21-audit-initial.md) |
| 2026-11-22 | PR-20 | Centre des grands ronds-points | DA + Level Designer | ✅ A2 en ville, A3 en montagne, A1 en campagne ; B (repère) abandonné : sculpture et tracteur rejetés ([visuel](visuels/PR-20-centre-rond-point.html)) | [audit, tour 8](audits/AUDIT-2026-11-21-audit-initial.md) |

### ⏸️ En attente (à reprendre dans les prochains audits)

- 2026-11-22 · PR-18 · Régime idéal au départ (Game Designer + 3C) : ⏸️ plus tard, idée de Baptiste ([audit, tour 8](audits/AUDIT-2026-11-21-audit-initial.md)).

- 2026-11-21 · Tunnels à tester (note de Baptiste) : les ponts ont été corrigés (garde-corps continus, lisses en courbe), pas les tunnels. Vérifier en jeu parois, sortie et lisibilité ; un éclairage intérieur sera peut-être nécessaire.

## 🧑 Ressentis de Baptiste

| Date       | Test                                                        | Ressenti                                                                                                                                                                                  | Ce que ça tranche                                                                                                                                              |
| ---------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-21 | T-1 · Vitesse à 150 km/h, vue poursuite                     | « juste »                                                                                                                                                                                 | Caméra et FOV gardés                                                                                                                                           |
| 2026-11-21 | T-3 · Aide aux commandes après 2 courses                    | « non » (il ne la regarde plus)                                                                                                                                                           | L'option existante suffit                                                                                                                                      |
| 2026-11-21 | T-2 · Ouverture de _Road_                                   | « c'est une route de test, mais c'est ennuyeux. Ça montre une grosse accélération, il faut des décors sur les bas-côtés, des chicanes »                                                   | Ouvre PR-6                                                                                                                                                     |
| 2026-11-21 | T-4 · `road` après PR-6 : décor, chicane, panneaux chevrons | décor : « oui » · chicanes : « juste » · panneaux : « je les vois sans m'en servir pour le freinage, mais c'est une info visuelle d'un virage fort. C'est plutôt bien » · ennui : « non » | Ouverture de `road` réveillée : critère de l'étape 9 rempli sur `road`. Panneaux gardés tels quels, rôle d'alerte de virage fort plutôt que repère de freinage |
| 2026-11-21 | T-5 · Tonneau après un gros choc                            | « on part sur C » ; aussi en chute dans un ravin, où la voiture « plane »                                                                                                                 | PR-12 en C étendue                                                                                                                                             |

## Index

| Fichier                                                                    | Statut                                                             |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [AUDIT-2026-11-21-audit-initial](audits/AUDIT-2026-11-21-audit-initial.md) | planifié → [PLAN-audit-2026-11-21](plans/PLAN-audit-2026-11-21.md) |
| [PLAN-audit-2026-11-21](plans/PLAN-audit-2026-11-21.md)                    | validé                                                             |
| [GDD](GDD.md)                                                              | validé                                                             |
| [BUGS](BUGS.md)                                                            | 1 ouvert : B-6 · vérifiés : B-1, B-2, B-4, B-5                     |
