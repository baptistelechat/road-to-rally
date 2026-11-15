// Ambiance choisie dans les menus, gardée dans le stockage local. `?look=` dans l'URL reste prioritaire au chargement.
import {
  DEFAULT_LOOK,
  type LookId,
  MENU_LOOKS,
  readLookParam,
} from "@/render/look";

const LOOK_KEY = "rally:look";

/** Une valeur absente ou hors des menus reprend l'ambiance par défaut. */
export const parseLook = (raw: string | null): LookId =>
  MENU_LOOKS.find((look) => look === raw) ?? DEFAULT_LOOK;

export const loadLook = (): LookId => {
  try {
    return parseLook(localStorage.getItem(LOOK_KEY));
  } catch {
    return DEFAULT_LOOK;
  }
};

export const saveLook = (look: LookId): void => {
  try {
    localStorage.setItem(LOOK_KEY, look);
  } catch {
    // ponytail: stockage bloqué, le choix vit juste le temps de la session
  }
};

/** L'URL d'abord, sinon le choix enregistré. */
export const initialLook = (): LookId => readLookParam() ?? loadLook();

/** Un choix au menu remplace `?look=` : sans ça, l'URL le masquerait au rechargement. */
export const dropLookParam = (): void => {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("look")) return;
  url.searchParams.delete("look");
  window.history.replaceState(window.history.state, "", url);
};
