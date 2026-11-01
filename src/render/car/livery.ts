/** Palette de la voiture : changer ces couleurs suffit à la repeindre. Couleurs CSS en hexadécimal. */
export interface Livery {
  /** Haut de caisse, habitacle */
  primary: string;
  /** Bas de caisse, lame d'aileron */
  secondary: string;
  /** Bande de caisse, bandes de capot et de toit, bavettes, flasques d'aileron */
  accent: string;
  /** Jantes */
  rim: string;
}

export const defaultLivery: Livery = {
  primary: "#efe6d2",
  secondary: "#1f3a5f",
  accent: "#d9472b",
  rim: "#d9a441",
};

const LIVERY_KEY = "rally:livery";
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** Une couleur absente ou invalide reprend sa valeur d'origine. */
export const parseLivery = (raw: string | null): Livery => {
  const livery = { ...defaultLivery };
  try {
    const stored = JSON.parse(raw ?? "null") as Partial<
      Record<keyof Livery, unknown>
    > | null;
    for (const key of Object.keys(livery) as (keyof Livery)[]) {
      const value = stored?.[key];
      if (typeof value === "string" && HEX_COLOR.test(value))
        livery[key] = value;
    }
  } catch {
    // JSON illisible : on garde la livrée d'origine.
  }
  return livery;
};

export const loadLivery = (): Livery => {
  try {
    return parseLivery(localStorage.getItem(LIVERY_KEY));
  } catch {
    return defaultLivery;
  }
};

export const saveLivery = (livery: Livery): void => {
  try {
    localStorage.setItem(LIVERY_KEY, JSON.stringify(livery));
  } catch {
    // ponytail: stockage bloqué, la livrée vit juste le temps de la session
  }
};
