# Epic 6 : Partage

**Statut : à faire. Détail à préciser à la fin de l'epic 5.**

Dernière brique de la v0 : un lien lance un défi à un ami, sans backend ni compte.

**Passage : un ami ouvre le lien et tente de battre ton temps.**

| Story | Sujet                   | Critère                                                                                 |
| ----- | ----------------------- | --------------------------------------------------------------------------------------- |
| 6.1   | Encodage de la spéciale | Géométrie finale et éléments ajoutés, compressés et versionnés dans l'URL               |
| 6.2   | Ouverture d'un lien     | Régénération de la spéciale, puis cache IndexedDB, avec un écran de chargement          |
| 6.3   | Temps et défi           | Temps et pseudo dans le lien, affiché comme « temps à battre »                          |
| 6.4   | Partager                | Bouton de copie du lien à la fin d'une course                                           |
| 6.5   | Mentions légales        | Attribution OSM et IGN dans le jeu, vérification de l'ODbL pour les spéciales partagées |
| 6.6   | Mise en ligne           | Déploiement Vercel, et test du parcours complet par un ami sur une autre machine        |

**Choix important pour 6.1 :** encoder la géométrie accrochée aux routes, pas les seuls points de passage. Si OSM évolue, BRouter calculerait une autre route et le temps partagé ne voudrait plus rien dire. La taille de l'URL est à mesurer tôt sur une spéciale de 15 km.

**Accepté en bac à sable :** un temps dans une URL se falsifie en 2 secondes. Le fantôme dans le lien est reporté, sa taille rendant probablement nécessaire un stockage en ligne.
