---
version: alpha
name: Road to Rally — Nuit facettée
description: La spéciale de nuit dans un monde low-poly. Montagnes taillées bleu nuit, faisceau de phares jaune, chrono en chiffres d'afficheur.
colors:
  brand: "#b07e00"
  brand-foreground: "#10161f"
  background: "#eef1f5"
  foreground: "#10161f"
  card: "#ffffff"
  card-foreground: "#10161f"
  popover: "#ffffff"
  popover-foreground: "#10161f"
  primary: "#10161f"
  primary-foreground: "#f5f7fa"
  secondary: "#e1e6ee"
  secondary-foreground: "#10161f"
  muted: "#e5e9ef"
  muted-foreground: "#4f5a6a"
  accent: "#dde3ec"
  accent-foreground: "#10161f"
  destructive: "#c62828"
  border: "#cfd6e0"
  input: "#7c8592"
  ring: "#10161f"
  chart-1: "#b07e00"
  chart-2: "#2f6fd1"
  chart-3: "#d4572a"
  chart-4: "#2e8a55"
  chart-5: "#8a4fd1"
  sidebar: "#ffffff"
  sidebar-foreground: "#10161f"
  sidebar-primary: "#10161f"
  sidebar-primary-foreground: "#f5f7fa"
  sidebar-accent: "#dde3ec"
  sidebar-accent-foreground: "#10161f"
  sidebar-border: "#cfd6e0"
  sidebar-ring: "#10161f"
  brand-dark: "#ffd23f"
  brand-foreground-dark: "#0b1018"
  background-dark: "#0b1018"
  foreground-dark: "#e9edf3"
  card-dark: "#121a26"
  card-foreground-dark: "#e9edf3"
  popover-dark: "#121a26"
  popover-foreground-dark: "#e9edf3"
  primary-dark: "#ffd23f"
  primary-foreground-dark: "#0b1018"
  secondary-dark: "#1a2433"
  secondary-foreground-dark: "#e9edf3"
  muted-dark: "#172030"
  muted-foreground-dark: "#93a0b4"
  accent-dark: "#1e2a3c"
  accent-foreground-dark: "#e9edf3"
  destructive-dark: "#ff6b5e"
  border-dark: "#202c3f"
  input-dark: "#56657d"
  ring-dark: "#ffd23f"
  chart-1-dark: "#ffd23f"
  chart-2-dark: "#5fb3ff"
  chart-3-dark: "#ff8f5a"
  chart-4-dark: "#7ee0a1"
  chart-5-dark: "#c792ff"
  sidebar-dark: "#121a26"
  sidebar-foreground-dark: "#e9edf3"
  sidebar-primary-dark: "#ffd23f"
  sidebar-primary-foreground-dark: "#0b1018"
  sidebar-accent-dark: "#1e2a3c"
  sidebar-accent-foreground-dark: "#e9edf3"
  sidebar-border-dark: "#202c3f"
  sidebar-ring-dark: "#ffd23f"
  sky-top-dark: "#05080f"
  sky-horizon-dark: "#1c2a45"
  mountain-light-dark: "#2b3c5e"
  mountain-mid-dark: "#22304d"
  mountain-shadow-dark: "#111b2c"
  ground-dark: "#0d1420"
  road-dark: "#2a3346"
typography:
  display:
    fontFamily: Michroma
    fontSize: 1.5rem
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: 0.04em
  label:
    fontFamily: Michroma
    fontSize: 0.65rem
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 0.18em
  body:
    fontFamily: Manrope
    fontSize: 0.875rem
    fontWeight: 500
    lineHeight: 1.5
  body-strong:
    fontFamily: Manrope
    fontSize: 0.875rem
    fontWeight: 700
    lineHeight: 1.5
  chrono:
    fontFamily: Share Tech Mono
    fontSize: 3rem
    fontWeight: 400
    lineHeight: 1
rounded:
  sm: 2.4px
  md: 3.2px
  lg: 4px
  xl: 5.6px
spacing:
  hud-edge: 16px
  panel-x: 16px
  panel-y: 8px
components:
  hud-panel:
    backgroundColor: "{colors.background-dark}"
    textColor: "{colors.foreground-dark}"
    rounded: "{rounded.md}"
    padding: 8px 16px
  hud-chrono:
    textColor: "{colors.brand-dark}"
    typography: "{typography.chrono}"
  hud-label:
    textColor: "{colors.muted-foreground-dark}"
    typography: "{typography.label}"
  button-start:
    backgroundColor: "{colors.brand-dark}"
    textColor: "{colors.brand-foreground-dark}"
    rounded: "{rounded.lg}"
    padding: 12px 16px
  card:
    backgroundColor: "{colors.card-dark}"
    textColor: "{colors.card-foreground-dark}"
    rounded: "{rounded.lg}"
    padding: 16px
---

# Road to Rally — Nuit facettée

## Overview

Une spéciale de rallye roulée de nuit, dans un monde low-poly : tout est taillé en facettes planes, rien n'est lisse. Le ton est celui d'un écran de jeu, sobre et nocturne. Le jaune des phares est la seule couleur vive et sert à ce qui compte en course (chrono, vitesse, action principale).

**Élément signature : la scène facettée.** Un ciel en dégradé vertical (`sky-top-dark` → `sky-horizon-dark`), deux plans de montagnes en triangles plats (faces éclairées en `mountain-light-dark`, faces d'ombre en `mountain-mid-dark` puis `mountain-shadow-dark`), un sol uni (`ground-dark`), une route en trapèze qui file vers l'horizon (`road-dark`) avec des tirets centraux en `foreground` à 50 %, et un faisceau de phares, un trapèze `brand` à 16 % d'opacité posé sur la route. On la retrouve dans l'og:image (`public/brand/og-scene.svg`), dans le fond de l'icône et derrière les écrans de menu. Le HUD flotte par-dessus dans des panneaux translucides.

**Logo.** L'Épingle : un col facetté traversé par des lacets, sur une tuile au fond low-poly (`public/icon.svg`, angles droits ; les arrondis sont ajoutés par le support, comme l'og:image ou l'écran titre). Le logotype « Road to Rally » est dessiné en tracés facettés : `public/brand/road-to-rally.svg` (empilé), `road-to-rally-line.svg` (une ligne), `title-screen.svg` (écran titre).

Le thème sombre est le thème par défaut : `<html class="dark">`. Le thème clair existe pour les rares écrans « de jour ».

## Colors

Les clés sans suffixe sont le thème clair, les clés en `-dark` le thème sombre (convention du projet, la spec n'a pas de notion de thème). Les mêmes valeurs vivent en `oklch` dans `src/app/globals.css`.

- **brand** : le jaune des phares (`#ffd23f` de nuit). Chrono, vitesse, bouton de départ, focus, tracé sur la minimap, élément sélectionné dans un menu. Texte posé dessus : `brand-foreground`.
- **primary** : de nuit, c'est aussi le jaune (bouton principal shadcn). De jour, l'encre bleu nuit.
- **accent** : la teinte de **survol** des menus et listes, à peine décalée du fond. Ce n'est pas une couleur de marque : ne jamais l'utiliser pour mettre quelque chose en avant.
- **muted-foreground** : labels, descriptions, aides.
- **destructive** : sortie de route, pénalité, abandon.
- **chart-1..5** : séries de graphiques et cibles (or, argent, bronze…), `chart-1` = `brand`.
- **sky-\*, mountain-\*, ground, road** : palette de la scène facettée, hors shadcn.

Les couleurs à sens propre au jeu (zone rouge du compte-tours, sévérité des virages des notes, panneaux routiers) restent hors de cette palette.

## Typography

- **Michroma** (`font-display`) : titres, labels du HUD en capitales espacées. Large et technique, à garder court.
- **Manrope** (`font-body`, police par défaut) : tout le texte courant et les menus.
- **Share Tech Mono** (`font-mono`) : chrono, vitesse, plaque, numéro, tout chiffre qui doit sonner « afficheur ». Toujours avec `tabular-nums`.

Chargées par `next/font/google` dans `src/app/layout.tsx`.

## Layout

En course, l'écran appartient à la route : les éléments du HUD se collent aux coins (`hud-edge` de 16 px), jamais au centre, sauf les notes du copilote en haut. Les menus (pause, arrivée, garage) sont des colonnes étroites posées sur la scène, pas des pages pleines.

## Elevation & Depth

Pas d'ombres portées sur l'interface. La profondeur vient de la transparence : les panneaux du HUD sont du `background` à 65 % avec une bordure `foreground` à 15 %, la scène reste visible dessous. Seul le logo dans l'og:image porte un halo jaune diffus.

## Shapes

Rayon de base très faible (`--radius: 0.25rem`) : coins à peine cassés, en écho aux facettes. Les formes décoratives sont des triangles et des trapèzes à arêtes vives, jamais de courbes ni de dégradés doux en dehors du ciel.

## Components

- **hud-panel** : panneau translucide du HUD (`bg-background/65`, `border-foreground/15`, `rounded-md`), texte `foreground`.
- **hud-chrono** : temps en `chrono`, couleur `brand`. Les écarts négatifs en `chart-4`, positifs en `destructive`.
- **hud-label** : `label` en capitales, `muted-foreground`, au-dessus d'une valeur.
- **button-start** : action principale d'un écran (« Prendre le départ », « Lancer le défi »), fond `brand`, texte `brand-foreground`, survol `brand` à 85 %.
- **card** : panneaux de menu (pause, arrivée), `card` sur la scène, items survolés en `accent`.

## Do's and Don'ts

- ✅ Une seule zone jaune par écran pour l'action ou la donnée clé ; le reste en `foreground` et `muted-foreground`.
- ✅ Les chiffres en `font-mono` avec `tabular-nums`, pour que le chrono ne tremble pas.
- ❌ Jamais `accent` comme couleur de mise en avant : c'est le survol.
- ❌ Jamais de couleur en dur (`amber-400`, `white/70`, `bg-black/65`) dans le HUD : passer par les tokens. Exception : les couleurs SVG, qui ne lisent pas les variables CSS, reprennent l'hex du token avec un commentaire.
- ❌ Pas de texte `brand` sur `muted` ou `card` en thème clair : le jaune foncé y descend sous 4.5:1 pour du petit texte.
- ❌ Pas de surfaces lisses ni d'arrondis généreux : ça casse le monde facetté.
