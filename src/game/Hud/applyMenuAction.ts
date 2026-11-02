import { setHudScreen, useHudStore } from "@/game/hudStore";
import { type MenuAction, stepMenuIndex } from "@/input/smoothing";

/**
 * Manette : haut et bas déplacent le focus, A clique sur le bouton qui l'a.
 * Une liste ouverte retient le focus et B la referme ; sinon B reprend la course en pause, et ne fait rien au départ.
 * Son bloqué : A n'active pas les boutons `data-needs-sound`, un clic de manette ne débloquerait rien.
 */
export const applyMenuAction = (
  action: MenuAction,
  soundBlocked: boolean,
): void => {
  const list = document.querySelector('[role="listbox"]');
  if (action === "cancel") {
    if (list)
      document.querySelector<HTMLElement>('[aria-expanded="true"]')?.click();
    else if (useHudStore.getState().screen === "pause") setHudScreen("race");
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
