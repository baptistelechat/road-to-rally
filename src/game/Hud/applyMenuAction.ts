import { setHudScreen } from "@/game/hudStore";
import { type MenuAction, stepMenuIndex } from "@/input/smoothing";

/**
 * Manette : haut et bas déplacent le focus, A clique sur le bouton qui l'a.
 * Une liste ouverte retient le focus et B la referme ; sinon B ferme le menu.
 */
export const applyMenuAction = (action: MenuAction): void => {
  const list = document.querySelector('[role="listbox"]');
  if (action === "cancel") {
    if (list)
      document.querySelector<HTMLElement>('[aria-expanded="true"]')?.click();
    else setHudScreen("race");
    return;
  }
  const scope = list ?? document.querySelector("dialog[open]");
  const items = [
    ...(scope?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ??
      []),
  ];
  const current = items.indexOf(document.activeElement as HTMLButtonElement);
  if (action === "confirm") (items[current] ?? items[0])?.click();
  else items[stepMenuIndex(current, items.length, action)]?.focus();
};
