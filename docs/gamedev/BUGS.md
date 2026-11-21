# 🐞 Registre des bugs — Road to Rally

Tenu par le QA Tester du studio. Chaque bug reçoit un `B-n`, numéroté en continu. Un bug corrigé ne sort jamais du registre : c'est la checklist de non-régression.

Statuts : `ouvert` → `corrigé le <date>` → `vérifié le <date>` · `🔁 réapparu le <date>` (gravité +1 cran).

| B-n | Titre | Date | Gravité | Source | Repro | Attendu / obtenu | PR-n | Retest | Statut |
| --- | ----- | ---- | ------- | ------ | ----- | ---------------- | ---- | ------ | ------ |
| B-1 | Public et barrières des épingles perchés sur la montagne | 2026-11-21 | majeur | 🧑 + 📖 | `mountain` (régénérée en v21), rouler jusqu'aux épingles : barrières rouge et blanc et spectateurs posés haut sur le versant, loin au-dessus de la route | Attendu : public et barrières au niveau de la route ou sur un talus bas, à portée de vue · Obtenu : perchés plusieurs mètres au-dessus. Cause probable : `rallyDressing.ts` ne vérifie que la pente locale (≤ 20°), jamais l'écart de hauteur avec la route | — correctif validé le 2026-11-21 : écarter tout **objet** (public, barrières, habillage, panneaux) dont le sol est à plus de ~2,5 m au-dessus ou en dessous de la route ; la **végétation** reste autorisée sur le versant | 🤖 en jeu sur `mountain`, capture des épingles | ouvert |
| B-2 | Arche de secteur dans le talus et dans le vide sur route étroite | 2026-11-21 | majeur | 🧑 | `mountain`, secteur 2 : route à flanc de montagne | Attendu : arche posée sur le sol · Obtenu : un pied dans le talus, l'autre au-dessus du ravin. `archAt` (`scenery.ts`) pose l'arche à la hauteur de la route, pieds à 1,5 m du bord, sans lire le terrain | PR-10 (A par défaut, C sur route étroite) | 🤖 en jeu sur `mountain`, capture du secteur 2 · à retester après correctif | ouvert |
| B-3 | Arbres de bord de piste traversables | 2026-11-21 | majeur | 🧑 | Sortir largement de la route en forêt sur une spéciale avec décor IGN, foncer dans un arbre | Attendu : choc contre le tronc · Obtenu : la voiture traverse certains arbres. Les arbres réels n'avaient de collider qu'à moins de 15 m du bord de route (`DECOR_TREE_COLLIDER_REACH`) | — corrigé directement : portée passée à 25 m | 🧑 foncer dans des arbres à 15-25 m du bord | corrigé le 2026-11-21 |

Aucun bug relevé pendant l'audit du 2026-11-21 lui-même (console sans erreur sur _Road_). B-1 et B-2 viennent de Baptiste, après la régénération de `mountain`.
