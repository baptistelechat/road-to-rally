import { type GameScreen, setHudScreen, useHudStore } from "@/game/hudStore";
import { type MenuAction, stepMenuIndex } from "@/input/smoothing";

/** Effet de B : referme la liste, sinon revient au menu depuis un panneau, sinon reprend la course en pause. */
export const menuCancelTarget = (
  listOpen: boolean,
  hasBack: boolean,
  screen: GameScreen,
): "list" | "back" | "race" | null => {
  if (listOpen) return "list";
  if (hasBack) return "back";
  return screen === "pause" ? "race" : null;
};

/**
 * Manette : haut et bas déplacent le focus, A clique sur le bouton qui l'a.
 * Son bloqué : A n'active pas les boutons `data-needs-sound`, un clic de manette ne débloquerait rien.
 */
export const applyMenuAction = (
  action: MenuAction,
  soundBlocked: boolean,
): void => {
  const list = document.querySelector('[role="listbox"]');
  if (action === "cancel") {
    const back = document.querySelector<HTMLElement>("[data-menu-back]");
    const target = menuCancelTarget(
      list !== null,
      back !== null,
      useHudStore.getState().screen,
    );
    if (target === "list")
      document.querySelector<HTMLElement>('[aria-expanded="true"]')?.click();
    else if (target === "back") back?.click();
    else if (target === "race") setHudScreen("race");
    return;
  }
  const scope = list ?? document.querySelector("dialog[open]");
  const items = [
    ...(scope?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ??
      []),
  ];
  const current = items.indexOf(document.activeElement as HTMLButtonElement);
  if (action === "confirm") {
    const target = items[current] ?? items[0];
    if (!(soundBlocked && target?.dataset.needsSound !== undefined))
      target?.click();
  } else items[stepMenuIndex(current, items.length, action)]?.focus();
};
