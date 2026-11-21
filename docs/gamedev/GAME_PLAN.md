# 🎮 Game Plan — Road to Rally

## 📍 Où on en est

Audit initial du 2026-11-21 terminé et planifié. [PLAN-audit-2026-11-21](plans/PLAN-audit-2026-11-21.md) validé le 2026-11-21. Tour 2 décidé : PR-6, PR-7 et PR-8 validées et ajoutées au plan (étapes 9 à 11). Panneaux : B · Chevrons rallye. Étape 9 : code livré (panneaux dans la simulation, décor et chicanes dans `bake-stage`), lint et build OK, `road` (4 chicanes) et `mountain` régénérées en version 21 avec décor IGN le 2026-11-21. GDD validé. **À la reprise** : corriger B-1 et B-2 (étapes 12 et 13 du plan, puis retester), juger `road` au volant, `check:determinism` sur autorisation, commit, puis playtest de l'epic 4 (étape 2).

## Principes en vigueur sur ce projet

Le [GDD](GDD.md) est la seule source des métriques et de la bible :

- Voiture et métriques 3C : [GDD § 4 à 6](GDD.md#4-voiture-caractère)
- Règles de course : [GDD § 7](GDD.md#7-règles-de-course)
- Surfaces : [GDD § 9](GDD.md#9-surfaces)
- Bible visuelle : [GDD § 10](GDD.md#10-bible-visuelle)
- Budget de performance : [GDD § 12](GDD.md#12-budget-de-performance)

## Décisions

| Date       | PR   | Titre                                        | Persona       | Décision                                                                                                                 | Origine                                           |
| ---------- | ---- | -------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| 2026-11-21 | PR-1 | Fermer l'epic 4 avant tout nouveau code      | QA            | ✅ A : playtest dédié à l'epic 4                                                                                         | [audit](audits/AUDIT-2026-11-21-audit-initial.md) |
| 2026-11-21 | PR-2 | Écrire le GDD                                | Game Designer | ✅ A : GDD court reconstruit                                                                                             | [audit](audits/AUDIT-2026-11-21-audit-initial.md) |
| 2026-11-21 | PR-3 | Mesurer le critère de l'epic 5 en production | Tech Artist   | ✅ A, au moment de fermer l'epic 5 (après PR-1)                                                                          | [audit](audits/AUDIT-2026-11-21-audit-initial.md) |
| 2026-11-21 | PR-4 | Surface de rallye                            | Game Designer | ✅ C puis B : rien en v0, bas-côtés en gravier ensuite, d'autres surfaces à adhérence variée plus tard                   | [audit](audits/AUDIT-2026-11-21-audit-initial.md) |
| 2026-11-21 | PR-5 | L'aide aux commandes s'efface                | 3C            | ❌ rejetée : l'option `controlsHelpEnabled` existe déjà ; à repenser avec la version téléphone et ses commandes tactiles | [audit](audits/AUDIT-2026-11-21-audit-initial.md) |
| 2026-11-21 | PR-6 | Réveiller l'ouverture de `road` | Level Designer | ✅ A et B tout de suite, B sur toutes les générations, panneaux B · Chevrons rallye | [audit](audits/AUDIT-2026-11-21-audit-initial.md) |
| 2026-11-21 | PR-7 | Page téléphone en vocabulaire rallye | Directeur artistique | ✅ A · Parc fermé, avec le nom et le temps du défi | [audit](audits/AUDIT-2026-11-21-audit-initial.md) |
| 2026-11-21 | PR-8 | Son du public | Sound Designer | ✅ B · échantillons CC0, fiche du tour 2 | [audit](audits/AUDIT-2026-11-21-audit-initial.md) |
| 2026-11-21 | PR-9 | Ambiance par défaut | Directeur artistique | ✅ `afternoon` | [audit](audits/AUDIT-2026-11-21-audit-initial.md) |
| 2026-11-21 | PR-10 | Arche sur route étroite | DA + Level Designer | ✅ A par défaut, C sur route étroite | [audit](audits/AUDIT-2026-11-21-audit-initial.md) |

### ⏸️ En attente (à reprendre dans les prochains audits)



- Rien pour l'instant : les trois points en attente ont donné PR-6, PR-8 et PR-9.

## 🧑 Ressentis de Baptiste

| Date       | Test                                     | Ressenti                        | Ce que ça tranche         |
| ---------- | ---------------------------------------- | ------------------------------- | ------------------------- |
| 2026-11-21 | T-1 · Vitesse à 150 km/h, vue poursuite  | « juste »                       | Caméra et FOV gardés      |
| 2026-11-21 | T-3 · Aide aux commandes après 2 courses | « non » (il ne la regarde plus) | L'option existante suffit |
| 2026-11-21 | T-2 · Ouverture de _Road_ | « c'est une route de test, mais c'est ennuyeux. Ça montre une grosse accélération, il faut des décors sur les bas-côtés, des chicanes » | Ouvre PR-6 |



## Index

| Fichier                                                                    | Statut               |
| -------------------------------------------------------------------------- | -------------------- |
| [AUDIT-2026-11-21-audit-initial](audits/AUDIT-2026-11-21-audit-initial.md) | planifié → [PLAN-audit-2026-11-21](plans/PLAN-audit-2026-11-21.md) |
| [PLAN-audit-2026-11-21](plans/PLAN-audit-2026-11-21.md) | validé |
| [GDD](GDD.md)                                                              | validé  |
| [BUGS](BUGS.md) | 2 ouverts : B-1, B-2 |
