# Epic 4 : Course

**Statut : à faire. Stories 4.1 à 4.5 à préciser à la fin de l'epic 3. Le copilote (4.6 à 4.11) a ses fiches, car il ne dépend pas de l'éditeur.**

Transformer une route en spéciale chronométrée, avec un copilote : **la meilleure idée du PRD, celle qui fait « rallye ».**

**Passage : une spéciale complète se court du départ à l'arrivée, notes à l'heure.**

| Story                                          | Sujet                | Critère                                                                                                                 |
| ---------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 4.1                                            | Départ et arrivée    | Départ arrêté avec décompte, ligne d'arrivée, écran de résultat                                                         |
| 4.2                                            | Temps intermédiaires | Comparés au meilleur temps local                                                                                        |
| 4.3                                            | Remise sur la route  | Reprend la logique de 1.6, avec une pénalité de temps                                                                   |
| 4.4                                            | Meilleur temps local | Stocké par spéciale                                                                                                     |
| 4.5                                            | Fantôme              | Rejeu des entrées enregistrées depuis 1.3, voiture translucide                                                          |
| [4.6](epic-4-course/4.6-calcul-notes.md)       | Calcul des notes     | Tous les virages notés de 1 (épingle) à 6 (très rapide), avec précisions et enchaînements, sur une piste d'essai dédiée |
| [4.7](epic-4-course/4.7-voix-copilote.md)      | Voix du copilote     | Mots enregistrés et enchaînés, sans délai ni réseau en course                                                           |
| [4.8](epic-4-course/4.8-moment-note.md)        | Moment de la note    | Déclenchement selon la vitesse, toutes les annonces finies avant leur virage, aucune sautée                             |
| [4.9](epic-4-course/4.9-icones-virages.md)     | Icônes de virage     | Prochains virages affichés dans l'esprit WRC, lisibles sans légende                                                     |
| [4.10](epic-4-course/4.10-mini-carte.md)       | Mini-carte           | Tracé et position de la voiture, sans nuire à la lecture de la route. À reporter si le temps manque                     |
| [4.11](epic-4-course/4.11-options-copilote.md) | Options du copilote  | Voix, icônes et mini-carte activables, vitesse de diction réglable, à la souris, au clavier et à la manette             |

**Point de vigilance :** si le rejeu dérive entre machines, le fantôme local reste possible en enregistrant aussi la position. Le test navigateur contre Node de la story 1.4 tranche ce point.
