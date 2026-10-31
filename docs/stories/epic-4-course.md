# Epic 4 : Course

**Statut : à faire. Détail à préciser à la fin de l'epic 3.**

Transformer une route en spéciale chronométrée, avec un copilote : **la meilleure idée du PRD, celle qui fait « rallye ».**

**Passage : une spéciale complète se court du départ à l'arrivée, notes à l'heure.**

| Story | Sujet                | Critère                                                                                                     |
| ----- | -------------------- | ----------------------------------------------------------------------------------------------------------- |
| 4.1   | Départ et arrivée    | Départ arrêté avec décompte, ligne d'arrivée, écran de résultat                                             |
| 4.2   | Temps intermédiaires | Comparés au meilleur temps local                                                                            |
| 4.3   | Remise sur la route  | Reprend la logique de 1.6, avec une pénalité de temps                                                       |
| 4.4   | Meilleur temps local | Stocké par spéciale                                                                                         |
| 4.5   | Fantôme              | Rejeu des entrées enregistrées depuis 1.3, voiture translucide                                              |
| 4.6   | Calcul des notes     | Courbure vers note de 1 (épingle) à 6 (très rapide), plus « longue », « se resserre », « bosse », « crête » |
| 4.7   | Voix du copilote     | `speechSynthesis` avec une voix française, repli sur des notes affichées si aucune n'est disponible         |
| 4.8   | Moment de la note    | Déclenchement selon la vitesse et non une distance fixe : ni trop tôt, ni trop tard                         |

**Point de vigilance :** si le rejeu dérive entre machines, le fantôme local reste possible en enregistrant aussi la position. Le test navigateur contre Node de la story 1.4 tranche ce point.
