# 🗺️ Plan — suites de l'audit du 2026-11-21

- **Origine** : [AUDIT-2026-11-21-audit-initial](../audits/AUDIT-2026-11-21-audit-initial.md), propositions PR-1, PR-2, PR-3, PR-4
- **Statut du plan** : validé le 2026-11-21

Étapes du parcours studio sautées : fonction, raison d'être, cadre visuel, référence, white box, grey box et production ne s'appliquent pas. Ce plan ferme du travail existant, il n'ajoute pas de feature. Le jour où le gravier (étape 8) commencera, il aura son propre plan complet.

## Étapes

| #   | Étape                                           | Persona                          | Livrable                                                                                                 | Critère de fin                                                                                 | Coût si on saute                                                              | PR       | Validation                                                                                    | Fait |
| --- | ----------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------- | ---- |
| 1   | Relire et valider le GDD                        | Game Designer                    | `GDD.md` relu, ❓ tranchés ou laissés ouverts                                                            | Statut du GDD : validé                                                                         | Les audits suivants s'appuieraient sur une référence fausse                   | PR-2     | ✅ validée                                                                                  | [x] |
| 2   | Playtest de l'epic 4, parcours A à D ci-dessous | QA + 3C, au volant : Baptiste    | Chaque critère coché ✅ ou devenu un `B-n` dans `BUGS.md`                                                | Les 4 parcours faits                                                                           | Des stories 🟡 qui s'empilent, un bug du chrono découvert au milieu du décor  | PR-1     | ✅ validée                                                                                  | [ ]  |
| 3   | Corriger les bugs bloquants et majeurs trouvés  | dev normal, hors studio          | Un correctif par `B-n`                                                                                   | Chaque `B-n` majeur passe en `corrigé`, puis `vérifié` au retest                               | On fermerait l'epic sur un bug connu                                          | PR-1     | ✅ validée                                                                                  | [ ]  |
| 4   | Checks automatiques de l'epic 4                 | QA                               | `pnpm lint`, `pnpm build`, puis `pnpm check:determinism`                                                 | Les trois passent                                                                              | Une régression de déterminisme casserait le fantôme et le futur rejeu serveur | PR-1     | ✅ validée — **le check ne se lance qu'avec ton accord**, seul, jamais pendant que tu joues | [ ]  |
| 5   | Fermer l'epic 4                                 | Game Designer                    | Stories 4.1 à 4.11 cochées, roadmap à ✅                                                                 | Critère de passage : « une spéciale complète se court du départ à l'arrivée, notes à l'heure » | La règle d'or de la roadmap reste cassée                                      | PR-1     | ✅ validée                                                                                  | [ ]  |
| 6   | Mesurer le critère de l'epic 5 en production    | Tech Artist, tu lances           | Table de la story 5.6 remplie : `pnpm build`, `next start`, village, 10 s à l'arrêt puis 10 s en roulant | 60 FPS mesurés, ou un goulot identifié                                                         | Epic 5 impossible à fermer                                                    | PR-3     | ✅ validée — au moment de fermer l'epic 5, après l'étape 5                                  | [ ]  |
| 7   | Noter les surfaces futures dans le GDD          | Game Designer                    | GDD § 9 : rien en v0, bas-côtés en gravier, puis surfaces variées                                        | Fait le 2026-11-21                                                                             | —                                                                             | PR-4 (C) | ✅ validée                                                                                  | [x]  |
| 8   | Bas-côtés en gravier                            | Game Designer → 3C → Sound → VFX | Un plan complet dédié (fiche, adhérence chiffrée, son, poussière, couleur)                               | —                                                                                              | —                                                                             | PR-4 (B) | ⏸️ après la v0                                                                                | [ ]  |

### Ajouts du tour 2 (2026-11-21)

| # | Étape | Persona | Livrable | Critère de fin | Coût si on saute | PR | Validation | Fait |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 9 | Cartes livrées à jour et ouverture de `road` réveillée | Level Designer, dev normal | (A) `scripts/bake-stage.ts` ajoute le décor BD TOPO et les chicanes automatiques, `road` et `mountain` régénérées ; (B) dans le pipeline, pour **toute** génération : 3 panneaux de freinage à 150, 100 et 50 m avant un virage noté 1 à 3 qui suit une ligne droite de plus de 400 m, côté extérieur | `road` montre décor, chicane et panneaux au volant ; une spéciale créée dans l'éditeur aussi | Les cartes de vitrine restent figées à la version 6 du pipeline | PR-6 | ✅ validée, panneaux B · Chevrons rallye (jaune, chevrons noirs vers le virage, 3-2-1, sans chiffres) | [x] |
| 10 | Page téléphone « Parc fermé » | Directeur artistique, dev normal | `GameEntry.tsx` : la scène du parc fermé, le nom de la spéciale et le temps à battre lus dans l'URL, un bouton qui partage le lien (partage natif du téléphone) | Un lien de spéciale ouvert sur téléphone montre le défi et s'envoie vers un PC | L'ami qui reçoit le lien sur son téléphone abandonne | PR-7 | ✅ validée | [ ] |
| 11 | Son du public | Sound Designer, dev normal | Échantillons CC0 (3 à 4 variantes par son) : murmure par groupe, clameur au passage, cris sur choc, cornes et applaudissements au départ et à l'arrivée | Yeux fermés, on entend le public approcher, réagir au passage et au choc ; le déterminisme ne bouge pas | Un public muet casse l'ambiance rallye | PR-8 | ✅ validée | [ ] |

### Ajouts du tour 3 (2026-11-21)

| # | Étape | Persona | Livrable | Critère de fin | Coût si on saute | PR | Validation | Fait |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 12 | Objets au niveau de la route | QA, dev normal | `rallyDressing.ts` (et le public de `scenery.ts`) : aucun objet dont le sol est à plus de ~2,5 m de la route ; la végétation reste libre | B-1 retesté sur `mountain` : plus de public ni de barrière perchés | Le public flotte sur le versant à chaque spéciale de montagne | B-1 | ✅ validée | [x] |
| 13 | Arche selon le terrain | DA + Level Designer, dev normal | `archAt` lit le sol sous chaque pied : arche à pieds ajustés par défaut (A), banderole sur deux mâts (C) quand un pied ne trouve pas le sol à moins de ~3 m ; colliders ajustés | B-2 retesté sur `mountain`, secteur 2 ; check de déterminisme sur autorisation (les arches ont des colliders) | Arches dans le talus et dans le vide | PR-10, B-2 | ✅ validée | [x] |

### Ajouts du tour 4 (2026-11-21)

| # | Étape | Persona | Livrable | Critère de fin | Coût si on saute | PR | Validation | Fait |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 14 | Annonce finie avant le freinage | 3C, dev normal | `src/sim/paceNoteCue.ts` : la marge avant le virage vaut `ANTICIPATION + vitesse ÷ (2 × décélération)` au lieu d'1 s fixe ; décélération en constante réglable au volant | B-4 retesté sur `road` : à 150 km/h, la chicane est annoncée avant le point de freinage ; à 80 km/h, les annonces ne partent pas trop tôt | Les chicanes à pleine vitesse restent des pièges | PR-11, B-4 | ✅ validée (C) | [x] |
| 15 | Chocs et chutes naturels | 3C, dev normal | `src/sim/vehicle.ts`, `applyAssists` : les trois aides × (1 − `impact`) ; anti-tonneau et rappel de glisse coupés quand aucune roue ne touche | Une chicane prise à pleine vitesse fait valser la voiture ; une chute dans un ravin de `mountain` fait basculer la caisse ; un tonneau reste possible et la remise en piste le rattrape ; la conduite normale ne change pas (T-1) | Chocs « en carton », voiture qui plane | PR-12 | ✅ validée (C étendue) — **`check:determinism` sur ton accord** : la physique change ; les anciens fantômes sont **supprimés** (on est en dev, décidé le 2026-11-21), pas de compatibilité | [x] |
| 16 | Lisses de pont qui suivent la courbe | dev normal | `pushParapets` : une poutre de lisse par intervalle entre deux poteaux | B-5 retesté sur `Le Mans` : plus de « cordes » en travers de la route | Rambardes qui coupent la route sur chaque pont courbe | B-5 | ✅ correctif sans choix | [x] |
| 17 | Ombres plus loin | Lighting Artist + Tech Artist, dev normal | `Atmosphere.tsx` : zone d'ombre de 45 à 80 m de demi-côté, carte de 2048 à 4096 | Les ombres n'apparaissent plus sous les yeux en roulant sur `mountain` ; FPS mesurés avant et après, perte acceptée par toi (P10) | Ombres qui saccadent en roulant | PR-14 | ✅ validée (A) | [x] |
| 18 | Séparateurs autour des îlots | Level Designer + DA, dev normal | `islandSeparators.ts` : séparateurs plastique rouge et blanc (80 kg, renversables) sur l'anneau, butte d'herbe solide derrière (collider réduit de 0,8 m) ; sommet de la butte arrondi ; sous 2,5 m de rayon, la butte seule, sans barrière fixe (« deux réactions au choc pour les barrières, c'est pas logique ») | Un choc pousse et fait pivoter les séparateurs, la butte arrête la voiture, on ne coupe pas le rond-point | Barrières de rond-point indestructibles, à l'inverse des bas-côtés | PR-13 | ✅ validée (B) | [x] |
| 19 | Obstacles fixes lisibles comme fixes | DA + Level Designer, dev normal | `models.ts`, `ChicaneView.tsx` : glissière métallique sur les faces des chicanes, béton profilé sur les terre-pleins, cœur d'îlot en jardinière ou en rochers ; colliders inchangés | En jeu, rien de fixe ne ressemble à une barrière renversable | Deux réactions au choc pour des barrières qui se ressemblent | PR-15, PR-16 | ✅ validée | [x] |

### Ajouts du tour 8 (2026-11-22)

| # | Étape | Persona | Livrable | Critère de fin | Coût si on saute | PR | Validation | Fait |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 20 | Moteur qui monte pendant le décompte | Sound Designer, dev normal | `src/audio/` : pendant le décompte, le son suit un régime libre calculé à partir de la pédale (modèle `stepRev` du labo son) ; `simulation.ts` intact | B-11 retesté sur `road` : gaz à fond pendant le décompte, le moteur monte, la voiture ne bouge pas | Chaque départ reste silencieux | PR-17, B-11 | ✅ validée (A) | [ ] |
| 21 | Arche hors du terre-plein | Level Designer, dev normal | `archAt` (`scenery.ts`) : pieds ramenés au bord de la voie, avant la glissière du terre-plein (B) ; banderole sur deux mâts (C) quand il n'y a pas la place ; colliders suivent | B-12 retesté : l'arche « Secteur 2 » de la spéciale de ville n'est plus dans la glissière | Arches plantées dans le béton sur chaque 2×2 voies | PR-19, B-12 | ✅ validée (B, C en repli) | [ ] |
| 22 | Centre des grands ronds-points | DA + Level Designer, dev normal | Centre d'îlot selon le rayon (cœur PR-16 seul sous 2,5 m, A léger jusqu'à 8 m, A complet au-delà) et selon le milieu : A2 jardin fleuri en ville, A3 rocaille et pins en montagne, A1 bosquet en campagne ; pas d'objet repère ; troncs seuls avec collider | Un grand rond-point de `Clisson` n'a plus l'air vide | Grands îlots qui se lisent comme un oubli | PR-20 | ✅ validée (A2 ville, A3 montagne, A1 campagne) — **après l'étape B-14** | [ ] |

Ordre conseillé : 9 en entier (A et B ensemble), car B change le pipeline et forcerait sinon à régénérer `road` et `mountain` deux fois. L'étape 10 dépend du format du lien de partage (epic 6) pour le temps à battre : en attendant, elle lit ce que l'URL contient déjà.

## Checklist de playtest de l'epic 4 (étape 2)

Seuls les critères qui demandent tes yeux et tes mains. Les critères `lint`, `build` et `check` sont à l'étape 4. Prévoir environ 10 à 15 min par parcours, clavier **et** manette si possible.

### Parcours A — Départ, arrivée, pénalités, record (stories 4.1, 4.3, 4.4) · carte `road`

- [x] Le décompte se lit d'un coup d'œil et ne cache pas la route.
- [x] Gaz à fond pendant le décompte : la voiture ne bouge pas, puis part franchement au GO.
- [x] Les feux se voient depuis la grille, et les bips tombent avec eux.
- [x] Relancer depuis la pause ou depuis le résultat relance le décompte.
- [x] L'écran de résultat se pilote à la souris, au clavier et à la manette.
- [x] Une remise en piste ajoute 5 s, visibles sur le chrono et sur le résultat.
- [x] Rester bloqué puis demander la remise reste préférable à insister dans le décor.
- [x] Aucune pénalité pendant le décompte ni après l'arrivée.
- [x] Un temps plus lent n'écrit rien.
- [x] Deux spéciales de l'éditeur gardent chacune leur record ; une spéciale modifiée repart sans record.
- [x] L'ancien record du circuit s'affiche toujours.
- [x] En navigation privée, le jeu tourne et le record vit le temps de la session.
- [x] Circuit : décompte au premier départ, puis les tours s'enchaînent sans interruption (critère réécrit le 2026-11-22 sur décision de Baptiste ; c'est déjà le comportement du code, `simulation.ts`).

### Parcours B — Intermédiaires et fantôme (stories 4.2, 4.5) · carte `mountain`, deux courses de suite

- [ ] 3 intermédiaires, chacun annoncé une seule fois.
- [ ] Le premier essai affiche les temps de passage sans écart ; les suivants affichent l'écart.
- [ ] L'écart reste lisible sans masquer les icônes de virage.
- [ ] La frise colore chaque secteur fini en vert ou en rouge.
- [ ] Les intermédiaires se voient sur la mini-carte (essayer les 4 styles).
- [ ] Une remise en piste en arrière ne réannonce pas un intermédiaire déjà franchi.
- [ ] Sur un aller-retour, un intermédiaire de l'aller n'est pas validé au retour.
- [ ] Après un record, la course suivante montre le fantôme dès le GO.
- [ ] Une remise en piste du fantôme le fait sauter, sans traverser le décor.
- [ ] Aucune baisse de fluidité sensible avec le fantôme affiché.

### Parcours C — Copilote (stories 4.6, 4.7, 4.8, 4.9, 4.11) · cartes `mountain` puis `track`

- [ ] À allure de course, on a le temps d'entendre la note avant le virage.
- [ ] Sur `track`, l'épingle est annoncée « 1 » ; la crête, la bosse et le virage qui se resserre sont reconnus.
- [ ] Les mots s'enchaînent sans trou gênant, au même volume.
- [ ] `M` coupe aussitôt la voix, une seconde pression la rétablit.
- [ ] Une phrase coupée par la pause est redite à la reprise ; relancer coupe la phrase en cours.
- [ ] Après une remise en piste, l'annonce suivante est celle du prochain virage ; aucune annonce n'est dite deux fois.
- [ ] Rien n'est annoncé dans les menus ni après l'arrivée.
- [ ] Les icônes se comprennent sans texte et se lisent d'un coup d'œil ; dans une enfilade, elles sont dans l'ordre de la route.
- [ ] Les icônes restent lisibles sur tous les décors et toutes les ambiances.
- [ ] Les options fonctionnent souris, clavier et manette, et survivent à un rechargement.
- [ ] Tout couper donne une course sans voix ni icône, sans erreur.
- [ ] Changer la vitesse de diction change aussi le moment de l'annonce.

### Parcours D — Mini-carte (story 4.10) · `track`, `road`, `mountain`, puis une spéciale de 15 km

- [ ] La forme du tracé se reconnaît.
- [ ] Le marqueur suit la voiture sans saccade et se recale après une remise en piste.
- [ ] La mini-carte ne cache ni le chrono, ni les icônes, ni la route.
- [ ] Une spéciale de 15 km reste lisible et fluide.

## À noter

La story 4.5 a encore la case « Brancher dans `useGameLoop.ts`, `Game.tsx` et les options » non cochée, alors que le fantôme y est branché (`GhostCar`, `ghostOutlet`). Elle a l'air faite : à cocher dans la story.

La story 4.1 dit encore « Le circuit roule exactement comme avant : pas de décompte » (critère et `sim.countdown()` « `null` sur le circuit ») : à réécrire en dev normal, d'après la décision du 2026-11-22 sur A13.
