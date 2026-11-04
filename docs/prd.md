# 🏁 Jeu de rallye navigateur : cadrage

Oct 27, 2026 · @Baptiste

## Le concept

L'idée tient la route, à une condition : prouver d'abord que la voiture est fun à piloter sur une route plate, avant de toucher à la moindre donnée géographique. Le jeu vit ou meurt sur le comportement de la voiture, pas sur la fidélité de la carte.

Résumé : le joueur trace une spéciale sur une carte, le jeu génère la route en 3D low-poly (relief, largeur, bâtiments, forêts) depuis des données libres, il roule chrono en main, puis enchaîne plusieurs spéciales en rallye et règle sa voiture entre deux.

Deux questions à trancher avant de coder :

- **Arcade ou simu ?** Les réglages fins (ressorts, différentiel, rapports) n'ont de sens que si la physique est assez réaliste pour qu'ils changent quelque chose. En pur arcade, ils deviennent décoratifs.
- **France seule ou monde entier ?** Les données IGN sont excellentes mais s'arrêtent aux frontières. Le monde entier impose des données plus grossières (relief à 30 m).

## Premier jet : le bac à sable (décidé le 27/10)

Premier jet limité à la France : on trace, on génère, on roule, on partage le tracé et son temps. Pas de monde, pas de classement, pas de rallye multi-spéciales.

| Inclus | Reporté |
| --- | --- |
| Tracé sur carte avec assistance | Monde entier (Copernicus) |
| Génération 3D : route, relief IGN, quelques bâtiments et arbres | Classements en ligne |
| Une voiture, chrono départ / arrivée | Rallye complet, réglages voiture |
| Notes de copilote dictées | Comptes utilisateurs |
| Partage par lien : tracé + temps encodés dans l'URL | Anti-triche (un temps dans une URL se falsifie en 2 secondes, acceptable en bac à sable) |

Sans backend, la spéciale est régénérée à partir du tracé à chaque ouverture du lien. La génération doit donc être déterministe (même tracé = même spéciale, même placement d'obstacles) et mise en cache dans IndexedDB.

### Arcade, simu ou entre les deux

| Critère | Arcade | Simulation |
| --- | --- | --- |
| Adhérence | Généreuse, glisse contrôlée et « scriptable » | Modèle de pneu réaliste (charge, température, angle de dérive) |
| Erreurs | Pardonnées : on rebondit, on repart | Punies : sortie de route, dégâts, abandon |
| Contrôles | Clavier ou manette suffisent | Volant quasi indispensable |
| Réglages | 3 à 5 curseurs à effet visible | Des dizaines de paramètres réalistes |
| Prise en main | Fun en 30 secondes | Des heures pour être rapide |
| Exemples | Art of Rally (low-poly, très proche de ton style) | Richard Burns Rally, EA Sports WRC |

Recommandation : une « simcade ». Physique arcade tolérante, mais avec un transfert de masse crédible (la voiture plonge au freinage, se déleste en côte) et, plus tard, 4 à 6 réglages qui changent vraiment le chrono : hauteur, raideur, répartition de freinage, différentiel, pneus.

### Notes de copilote dictées

- Calcul : la courbure le long du tracé donne la note du virage (1 = épingle, 6 = très rapide), plus « longue », « se resserre », « bosse », « crête » via le relief.
- Voix au premier jet : Web Speech API (`speechSynthesis`), gratuite, mais la voix française dépend du navigateur et de l'OS.
- Voix plus tard : des mots enregistrés (« gauche », « quatre », « longue ») enchaînés, comme dans les vrais jeux de rallye. Plus naturel et contrôlé.
- Piège : la note doit tomber au bon moment, ni trop tôt ni trop tard. Le déclenchement dépend de la vitesse, pas d'une distance fixe.

### Assistance de tracé et éléments ajoutés

Bonne nouvelle pour ton idée : les vrais rallyes posent déjà des chicanes en bottes de paille pour casser la vitesse, donc ce n'est pas un artifice de jeu, c'est réaliste.

| Assistance | Comment |
| --- | --- |
| Score du tracé en direct | Nombre de virages par km, dénivelé, plus longue ligne droite, affichés pendant le tracé |
| Suggestions | Proposer une variante par une route voisine plus sinueuse (calcul d'itinéraire qui favorise les petites routes) |
| Chicane auto | Sur toute ligne droite au-delà d'un seuil (ex. 400 m), placer une chicane en bottes de paille |
| Demi-tour | Autour d'un rond-point ou d'une épingle artificielle en bout de route, pour un tracé aller-retour |
| Éditeur | Le joueur peut déplacer ou supprimer chaque élément ajouté |

Avocat du diable : trop d'éléments automatiques et la route réelle disparaît sous les bottes de paille. Garde un plafond (ex. une chicane par km) et laisse le dernier mot au joueur.

### Idées à reprendre de Hardpack Rally

[Hardpack Rally](https://store.steampowered.com/app/5337420/Hardpack_Rally/) (sortie prévue le 17/03/2027, PC) vise la même cible : rallye arcade stylisé, physique maison « facile à prendre en main, dure à maîtriser », solo avec fantôme et classement quotidien.

| Idée | Adaptation chez toi |
| --- | --- |
| Battre les temps d'un ancien pilote pour débloquer ses voitures | Temps cibles bronze / argent / or par spéciale, calculés depuis la longueur et la courbure |
| Course quotidienne avec classement | La « spéciale du jour », à prévoir après le bac à sable |
| Fantôme du joueur | Déjà prévu ; le partager dans le lien de la spéciale |
| Temps du développeur à battre, livrée exclusive en récompense | Ton propre temps sur la spéciale partagée = défi lancé à un ami |
| Replays multi-caméras et mode photo | Le low-poly rend très bien en capture : bon moteur de partage sur les réseaux |
| Peu de voitures, très typées (propulsion, 4RM) | 2 ou 3 voitures bien différenciées plutôt que beaucoup de modèles |

### Chronos infalsifiables (après le bac à sable)

La méthode fiable : le navigateur envoie les entrées du joueur (volant, gaz, frein à chaque pas de physique), et le serveur rejoue la course pour recalculer le temps lui-même. Un temps envoyé tout seul ne prouve rien.

- Condition : une physique déterministe (même entrées = même résultat sur toutes les machines). Rapier propose une variante déterministe, à vérifier avant de s'engager.
- À faire dès le premier jet pour ne pas tout refaire : un pas de physique fixe (ex. 60 Hz, indépendant des FPS) et enregistrement des entrées, qui servent déjà au fantôme et au replay.
- En complément, des contrôles simples : temps aux points de passage, vitesse maximale plausible, temps minimal théorique de la spéciale.

## Avocat du diable

Le gros piège : croire que les données réelles font le jeu. Elles font le décor ; le plaisir vient du pilotage, du chrono et de la comparaison avec les autres.

| Points forts | Points faibles et pièges |
| --- | --- |
| Contenu quasi infini : n'importe quelle route devient une spéciale | Une vraie route est souvent ennuyeuse (lignes droites de départementale). Le joueur doit savoir choisir, ou le jeu doit l'aider |
| Accroche virale : « roule sur la route de chez toi » | La largeur de route est rarement renseignée dans OSM : il faudra la déduire du type de voie |
| Navigateur = zéro installation, une spéciale se partage par lien | Le relief brut est bosselé : il faut aplanir un couloir sous la route, sinon la voiture saute partout |
| Le low-poly cache le manque de précision des données et reste léger | Générer un maillage de route propre (virages serrés, épingles, carrefours) est le vrai défi technique |
| Classement par spéciale + fantôme = rejouabilité | Physique de voiture « fun » = des semaines de réglage au feeling, sans recette toute faite |
| Stack 100 % TypeScript que tu maîtrises | Arcade + réglages techniques = deux publics qui ne veulent pas la même chose |
|  | Hauteurs de bâtiments souvent absentes d'OSM ; forêts et villages denses = risque de chute de FPS |
|  | Licence ODbL d'OSM : attribution obligatoire, et une base de spéciales partagée en dérive, donc partage à l'identique |
|  | Interdit d'utiliser les données Google Maps pour générer un jeu : la vue carte doit être sur fond OSM |

Verdict : faisable en solo si tu découpes sévèrement. Le risque principal n'est pas technique, c'est de passer six mois sur le pipeline géo et de découvrir que la voiture n'est pas agréable.

## Sources de données libres

Pour la France, IGN + OSM couvrent tout gratuitement ; pour le monde, OSM + Copernicus suffisent avec un relief moins fin.

| Besoin | Source France | Source monde | Limite à connaître |
| --- | --- | --- | --- |
| Fond de carte de l'éditeur | [OpenFreeMap](https://openfreemap.org/) ou [Protomaps](https://protomaps.com/) (tuiles OSM) | Idem | Pas de Google Maps |
| Tracé et type de route | [OSM](https://www.openstreetmap.org/) via [Overpass API](https://overpass-api.de/) | Idem | Tag `width` rare : déduire de `highway` et `lanes` |
| Revêtement (asphalte, terre, gravier) | OSM, tags `surface` et `tracktype` | Idem | Souvent vide sur les petites routes |
| Relief | [RGE ALTI IGN](https://geoservices.ign.fr/rgealti) (1 à 5 m), via la Géoplateforme | Copernicus DEM 30 m, ou tuiles Terrarium | 30 m = virages en côte lissés |
| Bâtiments avec hauteur | [BD TOPO IGN](https://geoservices.ign.fr/bdtopo) | OSM (`building:levels` parfois) | Sans hauteur : valeur par défaut |
| Forêts, champs, eau | BD TOPO ou OSM `landuse` / `natural` | OSM | Polygones à peupler d'arbres instanciés |
| Accrochage du tracé aux routes | [BRouter](https://brouter.de/) ou OSRM | Idem | Serveurs publics limités : à auto-héberger si succès |

Les données IGN sont sous Licence Ouverte Etalab depuis 2021 ; OSM est sous ODbL (attribution + partage à l'identique des bases dérivées). Astuce : fais le traitement une fois à la création de la spéciale et stocke le résultat, pour ne jamais rappeler les API pendant la course.

## Stack recommandée

Next.js pour le site et l'éditeur, React Three Fiber + Rapier pour le jeu, Supabase pour les spéciales et les classements : tout en TypeScript avec pnpm.

| Couche | Choix | Pourquoi |
| --- | --- | --- |
| App, menus, éditeur | Next.js + Tailwind + shadcn/ui | Ta stack habituelle ; le jeu tourne dans un composant client |
| Carte de l'éditeur | [MapLibre GL JS](https://maplibre.org/) | Open source, tuiles OSM, profil d'altitude affichable |
| Rendu 3D | [Three.js](https://threejs.org/) via React Three Fiber + drei | Le standard web ; low-poly = flat shading + couleurs par sommet |
| Physique | [Rapier](https://rapier.rs/) (`@dimforge/rapier3d-compat`, WASM) | Contrôleur de véhicule à raycast intégré, paramètres de suspension et d'adhérence = base des futurs réglages |
| Calculs géo | Turf.js dans un Web Worker | Générer route et terrain sans figer l'interface |
| État | Zustand | Léger, marche dedans et dehors de React |
| Données en ligne | Supabase (Postgres + stockage) | Spéciales générées, chronos, fantômes ; un fichier JSON local suffit au début |
| Contrôles et son | Gamepad API + Web Audio | Manette native dans le navigateur ; un bon son moteur vaut beaucoup en arcade |

Alternative si Next.js gêne (rechargement du canvas, SSR inutile) : Vite + React pour la partie jeu seule. Babylon.js est aussi solide, mais Three.js colle mieux à ton écosystème React.

## Phases de développement

Huit phases, chacune avec un critère de passage : tant qu'il n'est pas atteint, on ne passe pas à la suivante. Les durées sont des estimations pour un dev solo sur son temps libre.

1. **Prototype de conduite** (2 à 4 semaines) : une voiture low-poly sur une route procédurale plate, caméra, manette, son moteur.
   - Passage : tu as envie d'y rejouer 10 minutes sans rien d'autre.
2. **Pipeline géo vers 3D** (3 à 6 semaines) : à partir d'un tracé figé (un fichier GPX), générer le ruban de route, le terrain et aplanir le couloir sous la route.
   - Passage : une vraie spéciale de 5 km roulable sans bug de maillage.
3. **Éditeur sur carte** (2 à 3 semaines) : départ, arrivée, points de passage, accrochage aux routes, profil d'altitude, limite de longueur (0,5 à 15 km).
   - Passage : un ami crée une spéciale sans ton aide.
4. **Chrono et course** (1 à 2 semaines) : départ arrêté, temps intermédiaires, remise sur la route, meilleur temps local, fantôme.
5. **Décor** (3 à 4 semaines) : bâtiments, forêts instanciées, panneaux, public, niveaux de détail.
   - Passage : 60 FPS sur un portable moyen dans un village.
6. **En ligne** (2 à 3 semaines) : partage par lien, classement par spéciale, vérification simple des temps (rejouer les entrées côté serveur plus tard).
7. **Rallye complet** (2 semaines) : enchaînement de spéciales, temps cumulé, parc d'assistance entre deux spéciales.
8. **Réglages voiture** (3 semaines et plus) : suspension, barres anti-roulis, rapports, différentiel, pneus selon le revêtement.
   - Passage : un bon réglage fait gagner du temps mesurable sur une spéciale donnée.

Les réglages arrivent en dernier volontairement : ils n'ont d'intérêt qu'avec des revêtements variés et une physique stabilisée. Prévois tout de même dès la phase 1 que les paramètres de la voiture vivent dans un objet de config, pas en dur.

## Améliorations et idées différenciantes

La meilleure idée à ajouter : des notes de copilote générées automatiquement à partir de la courbure du tracé. C'est ce qui fait « rallye » et aucune carte ne le donne toute seule.

| Idée | Intérêt | Effort |
| --- | --- | --- |
| Notes de copilote auto (« gauche 4 longue, attention bosse ») + synthèse vocale | Identité rallye, aide le joueur sur une route inconnue | Moyen |
| Spéciale du jour commune à tous (façon Wordle) | Rendez-vous quotidien, classement simple | Faible |
| Revêtement tiré d'OSM (asphalte, terre, neige selon la saison) | Donne enfin un sens aux réglages | Moyen |
| Score « intérêt » du tracé dans l'éditeur (nombre de virages, dénivelé) | Guide le joueur vers des routes fun | Faible |
| Fantôme du meilleur temps mondial | Rejouabilité sans multijoueur temps réel | Moyen |
| Catégories de voitures (traction, propulsion, 4RM) | Variété sans modéliser 50 voitures | Moyen |
| Contrôles tactiles mobile | Plus large public, mais conduite moins fine | Moyen |
| Dégâts légers reportés d'une spéciale à l'autre | Vraie tension sur un rallye complet | Élevé |

À éviter au début : le multijoueur en temps réel, la météo dynamique et la nuit. Ils multiplient le travail sans prouver que le cœur du jeu est bon.

## Sources

- [Rapier, moteur physique](https://rapier.rs/)
- [Three.js](https://threejs.org/) et [MapLibre GL JS](https://maplibre.org/)
- [IGN RGE ALTI](https://geoservices.ign.fr/rgealti) et [IGN BD TOPO](https://geoservices.ign.fr/bdtopo)
- [Licence OSM (ODbL)](https://www.openstreetmap.org/copyright)
- [Overpass API](https://overpass-api.de/), [BRouter](https://brouter.de/), [OpenFreeMap](https://openfreemap.org/), [Protomaps](https://protomaps.com/)

Liens donnés de mémoire, non revérifiés en ligne le jour de la rédaction.
