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

## À trancher avant 6.1 : figer la spéciale, pas seulement le tracé

**Noté le 04/11/2026, à la demande de Baptiste.** Le même GPX ne donne pas la même spéciale selon le jour : sans Overpass, la génération retombe sur les voies BRouter de l'éditeur (largeurs et ronds-points, sans ponts ni tunnels), ou sur 5 m partout pour un GPX importé. Deux amis peuvent donc rouler deux routes différentes avec le même lien, et leurs temps ne se comparent plus. Le secours BRouter est en place en attendant ; c'est cet epic qui doit régler le fond.

**Aujourd'hui :** aucun partage. `customStageUrl` (`/?map=custom&stage=<clé>`) désigne une entrée IndexedDB locale, introuvable sur une autre machine. Le Worker sait reconstruire une spéciale depuis des `StageInputs` sans réseau (`kind: "rebuild"`), mais ne les renvoie pas et le cache ne les garde pas.

**Tailles mesurées sur les fixtures** (`road`, environ 5,4 km) : `StageInputs` complets 48 Ko en gzip, dont 70 % de terrain ; sans terrain, 9 Ko en brotli ; `StageData` en JSON, 3,9 Mo.

| Option | Lien | Hébergement | Limite |
| --- | --- | --- | --- |
| A. `StageInputs` en gzip dans le `#` | 64 Ko (5 km) à 190 Ko (15 km) | aucun | Impossible à coller dans une messagerie (Discord : 2 000 caractères) |
| B. Voies et altitudes, terrain redemandé à l'IGN | 12 à 35 Ko | aucun | Le terrain est un collider : une mise à jour IGN change la physique |
| C. `StageInputs` sur Vercel Blob, identifiant dans le lien | ~40 caractères | une route `POST /api/stages` et Blob | Reconstruction chez l'ami : une montée de `PIPELINE_VERSION` casse les anciens liens |
| D. `StageData` sur Vercel Blob | ~40 caractères | idem | 20 à 50 fois plus de stockage, mais survit aux versions |

**Piste recommandée :** C, avec la version et l'empreinte `stageHash` dans la charge utile : refus ou « temps non comparable » si l'une diffère.

**Questions pour Baptiste :**

1. Un petit backend est-il acceptable ? Il contredit « sans backend ni compte », mais aucun lien court et figé n'existe sans lui.
2. Une montée de `PIPELINE_VERSION` casse-t-elle les anciens liens (C), ou doivent-ils survivre (D) ?
3. Partage-t-on une spéciale dégradée ? Figée, elle reste au moins comparable.
4. Héberger des voies OSM publie une base dérivée (ODbL : attribution, partage à l'identique). Acceptable, ou seulement des attributs déjà déduits ?
5. Si l'empreinte reconstruite diffère chez l'ami (Safari non testé), bloquer la course ou la laisser en « temps non comparable » ?
