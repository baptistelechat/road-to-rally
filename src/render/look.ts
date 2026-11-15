// Ambiances lumineuses (story 5.1), décrites comme des données : Atmosphere ne code aucune couleur en dur.
// Le brouillard finit avant le bord du terrain (1,5 km) et avant le plan lointain de la caméra (1 km par défaut) : `far` ≤ 950 m.
// Le soleil reste à ~100 m de la cible d'ombre : sa distance tient dans `shadow-camera-far`.

// Choix de Baptiste du 15/11 : midi, couvert et après l'orage retirés.
export const LOOKS = ["afternoon", "morning", "sunset", "mist", "dawn"] as const;
export type LookId = (typeof LOOKS)[number];

/** Ambiance sans choix enregistré ni paramètre d'URL */
export const DEFAULT_LOOK: LookId = "afternoon";

/** Ambiances proposées dans les menus : toutes. */
export const MENU_LOOKS: readonly LookId[] = LOOKS;

/** Libellés courts, tenus dans un choix de menu de 7 rem */
export const LOOK_NAMES: Record<LookId, string> = {
  afternoon: "Après-midi",
  morning: "Matin",
  sunset: "Couchant",
  mist: "Brume",
  dawn: "Aube",
};

export interface Look {
  sky: string;
  /** Distances de début et de fin du brouillard, en mètres */
  fog: { near: number; far: number };
  hemisphere: { sky: string; ground: string; intensity: number };
  sun: {
    color: string;
    intensity: number;
    /** Position du soleil par rapport à la cible de l'ombre : sa longueur (~100 m) tient dans `shadow-camera-far` */
    offset: { x: number; y: number; z: number };
  };
}

export const LOOK_PRESETS: Record<LookId, Look> = {
  // Valeurs d'origine, inchangées.
  afternoon: {
    sky: "#e9c9a2",
    fog: { near: 140, far: 760 },
    hemisphere: { sky: "#ffe2bd", ground: "#54603a", intensity: 1.1 },
    sun: { color: "#ffc98a", intensity: 2.4, offset: { x: 70, y: 55, z: 45 } },
  },
  // Soleil bas et froid venu de l'autre côté, brume bleutée plus proche.
  morning: {
    sky: "#bccbd6",
    fog: { near: 70, far: 520 },
    hemisphere: { sky: "#d6e2ee", ground: "#4a5a44", intensity: 1.2 },
    sun: { color: "#ffe6c4", intensity: 1.9, offset: { x: -80, y: 32, z: 50 } },
  },
  // Soleil rasant orangé, ciel doré rosé : ombres très longues.
  sunset: {
    sky: "#eeb08f",
    fog: { near: 110, far: 640 },
    hemisphere: { sky: "#ffcaa6", ground: "#4c4836", intensity: 0.95 },
    sun: { color: "#ff9a5c", intensity: 2.1, offset: { x: 88, y: 18, z: -45 } },
  },
  // Brume d'automne : brouillard proche et chaud, soleil voilé.
  mist: {
    sky: "#cfb99c",
    fog: { near: 30, far: 340 },
    hemisphere: { sky: "#f0d8b8", ground: "#5c4a30", intensity: 1.25 },
    sun: { color: "#ffd2a0", intensity: 1.2, offset: { x: -60, y: 45, z: 65 } },
  },
  // Aube froide : ciel bleuté, soleil très bas et pâle, ombres longues et légères.
  dawn: {
    sky: "#9fb2cc",
    fog: { near: 60, far: 480 },
    hemisphere: { sky: "#bccde6", ground: "#3e4a48", intensity: 1.05 },
    sun: {
      color: "#f2d6c4",
      intensity: 1.4,
      offset: { x: -85, y: 20, z: -48 },
    },
  },
};

export const isLookId = (value: string | null): value is LookId =>
  LOOKS.some((look) => look === value);

/** Lit `?look=` dans l'URL ; `null` si absent ou inconnu. */
export const readLookParam = (): LookId | null => {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("look");
  return isLookId(value) ? value : null;
};
