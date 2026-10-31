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
