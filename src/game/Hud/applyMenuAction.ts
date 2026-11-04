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
 * Manette : haut et bas déplacent le focus, A clique sur le bouton qui l'a, gauche et droite règlent un curseur ou parcourent une rangée de cartes.
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
    ...(scope?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input[type="range"]',
    ) ?? []),
  ];
  const focused = document.activeElement;
  const current = items.indexOf(focused as HTMLElement);
  if (
    (action === "left" || action === "right") &&
    focused instanceof HTMLInputElement &&
    focused.type === "range"
  ) {
    if (action === "left") focused.stepDown();
    else focused.stepUp();
    // `stepUp` passe sous le suivi de valeur de React : l'événement `input` déclenche bien `onChange`.
    focused.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }
  const radioGroup = focused instanceof HTMLElement
    ? focused.closest('[role="radiogroup"]')
    : null;
  if ((action === "left" || action === "right") && radioGroup) {
    const radios = [
      ...radioGroup.querySelectorAll<HTMLElement>('[role="radio"]'),
    ];
    radios[radios.indexOf(focused as HTMLElement) + (action === "right" ? 1 : -1)]?.focus();
    return;
  }
  if (action === "confirm") {
    const target = items[current] ?? items[0];
    if (!(soundBlocked && target?.dataset.needsSound !== undefined))
      target?.click();
    return;
  }
  // Une rangée de cartes est une seule ligne : haut et bas la traversent, en entrant sur la carte choisie.
  const stops = items.filter((item) => {
    const group = item.closest('[role="radiogroup"]');
    if (!group) return true;
    const anchor =
      group === radioGroup
        ? focused
        : (group.querySelector('[aria-checked="true"]') ??
          group.querySelector('[role="radio"]'));
    return item === anchor;
  });
  stops[
    stepMenuIndex(stops.indexOf(focused as HTMLElement), stops.length, action)
  ]?.focus();
};
