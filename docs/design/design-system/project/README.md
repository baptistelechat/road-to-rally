# Road to Rally — Nuit facettée

Source : `docs/design/DESIGN.md` du repo — ne pas éditer ici, republier depuis le repo.

Road to Rally est un jeu de rallye dans le navigateur : on trace une spéciale sur une carte de France, le jeu en fait une route en 3D low-poly, on la roule au chrono et on partage le tracé par lien. La direction **Nuit facettée**, c'est la spéciale de nuit dans ce monde low-poly : montagnes taillées bleu nuit, faisceau des phares jaune, chrono en chiffres d'afficheur. Le thème sombre est le thème par défaut ; le thème clair (« Jour ») sert aux rares écrans de jour.

## Ton et contenu

- Le pilotage passe avant tout : l'interface se tait pendant la course et laisse la route occuper l'écran.
- Les textes sont courts et concrets, en français : « Prendre le départ », « Reprendre », « Sortie de route au km 3,1 : +5 s ».
- Aucune consigne à l'écran : l'interface se comprend seule.
- Les noms de lieux et d'épreuves sont inventés ou génériques (Col de la Croix-Fry, Rallye des Alpes) : aucun vrai rallye ni sponsor.

## Fondations visuelles

### L'élément signature : la scène facettée

Tout est taillé en facettes planes. La scène (`assets/Illustrations/og-scene.svg`) se compose de :

- un ciel en dégradé vertical, de `scene-sky-top` à `scene-sky-horizon` ;
- deux plans de montagnes en triangles plats : faces éclairées en `scene-mountain-light`, faces d'ombre en `scene-mountain-mid` puis `scene-mountain-shadow` ;
- un sol uni `scene-ground` ;
- une route en trapèze qui file vers l'horizon, en `scene-road`, avec des tirets centraux en `foreground` à 50 % ;
- un faisceau de phares, un trapèze `brand` à 16 % d'opacité posé sur la route.

On la retrouve dans l'og:image, dans le fond de l'icône et derrière les menus. Le HUD flotte par-dessus.

### Couleurs

- `brand` : le jaune des phares, seule couleur vive. Chrono, vitesse, bouton de départ, focus, tracé sur la minimap, élément sélectionné. Texte posé dessus : `brand-foreground`.
- `primary` : de nuit c'est aussi le jaune (bouton principal) ; de jour, l'encre bleu nuit.
- `accent` : la teinte de **survol** des menus, presque le fond. Ce n'est pas une couleur de marque.
- `muted-foreground` : labels, descriptions, aides.
- `destructive` : sortie de route, pénalité, abandon, écart de temps positif ; `chart-4` pour un écart négatif.
- Les couleurs qui ont un sens dans le jeu (zone rouge du compte-tours, sévérité des virages, panneaux routiers) restent hors palette.

### Typographie

- **Michroma** (`display`) : titres et labels du HUD en capitales espacées (`hud-label`). Police large et technique : la garder pour des textes courts.
- **Manrope** (`body`) : texte courant, menus, police par défaut.
- **Share Tech Mono** (`mono`) : chrono, vitesse, plaque, numéro, tout chiffre qui doit sonner « afficheur ». Toujours avec `tabular-nums`.

### Formes, profondeur, mise en page

- Rayon de base très faible (`radius-lg` = 4 px) : coins à peine cassés, en écho aux facettes. Décor en triangles et trapèzes à arêtes vives, jamais de courbes.
- Pas d'ombres portées : la profondeur vient de la transparence. Les panneaux du HUD sont du `background` à 65 % avec une bordure `foreground` à 15 %.
- En course, le HUD se colle aux coins (`space-hud-edge`), jamais au centre, sauf les notes du copilote en haut. Les menus sont des colonnes étroites posées sur la scène.

## Logos et illustrations

- `assets/Logos/road-to-rally-icon.svg` : l'icône **Épingle**, un col facetté traversé par des lacets sur une tuile au fond low-poly. Angles droits : c'est le support qui arrondit (og:image, écran titre).
- `assets/Logos/road-to-rally-wordmark.svg` : le logotype facetté, empilé.
- `assets/Logos/road-to-rally-wordmark-line.svg` : le logotype sur une ligne, pour les bannières et les en-têtes. Il est blanc ; sur un fond clair, le teinter en `foreground`.
- `assets/Illustrations/title-screen.svg` : l'écran titre, référence de composition (icône arrondie + logotype sur la scène).
- `assets/Illustrations/og-scene.svg` : la scène facettée seule, fond réutilisable.

## Composants (recettes)

- **hud-panel** : `background` à 65 %, bordure `foreground` à 15 %, `radius-md`, padding `space-panel-y` / `space-panel-x`, texte `foreground`.
- **hud-chrono** : temps en style `chrono`, couleur `brand`.
- **hud-label** : style `hud-label`, couleur `muted-foreground`, au-dessus d'une valeur.
- **button-start** : action principale d'un écran (« Prendre le départ », « Lancer le défi »), fond `brand`, texte `brand-foreground`, survol `brand` à 85 %, `radius-lg`.
- **card** : panneaux de menu (pause, arrivée), fond `card`, items survolés en `accent`.

## À faire / à éviter

- ✅ Une seule zone jaune par écran, pour l'action ou la donnée clé ; le reste en `foreground` et `muted-foreground`.
- ✅ Les chiffres en `mono` avec `tabular-nums`, pour que le chrono ne tremble pas.
- ❌ Jamais `accent` comme couleur de mise en avant : c'est le survol.
- ❌ Jamais de couleur en dur dans le HUD : passer par les tokens. Exception : un attribut SVG ne lit pas les variables CSS, il reprend l'hex du token avec un commentaire.
- ❌ Pas de texte `brand` sur `muted` ou `card` en thème Jour : le jaune foncé y descend sous 4.5:1 pour du petit texte.
- ❌ Pas de surfaces lisses ni d'arrondis généreux : ça casse le monde facetté.

## Dans le code

Les tokens vivent en `oklch` dans `src/app/globals.css` (`:root` pour Jour, `.dark` pour Nuit) et s'utilisent par les utilitaires Tailwind (`bg-brand`, `text-muted-foreground`, `font-display`, `font-mono`). Les polices sont chargées par `next/font/google` dans `src/app/layout.tsx`.
