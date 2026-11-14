import { type GameScreen, setHudScreen, useHudStore } from "@/game/hudStore";
import type { MenuAction } from "@/input/smoothing";

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

/** `data-pad-skip` : bouton réservé à la souris, comme les flèches du bandeau de cartes. */
const PAD_ITEMS =
  'button:not(:disabled):not([data-pad-skip]), input[type="range"]';
/** Tolérance de mise en page, en pixels : deux boîtes qui se touchent restent sur deux lignes. */
const SLACK = 4;

interface Stop {
  /** Ce qui reçoit le focus : le choix en cours pour une rangée de choix */
  element: HTMLElement;
  /** Boîte de la case : celle du groupe entier pour une rangée de choix */
  rect: DOMRect;
}

/**
 * Une rangée de choix (`role="radiogroup"` : cartes, boutons côte à côte) compte pour une seule case,
 * qu'on rejoint sur le choix en cours, ou sur le choix déjà focalisé si on y est.
 */
const toStops = (items: HTMLElement[], focused: Element | null): Stop[] => {
  const stops: Stop[] = [];
  const groups = new Set<Element>();
  for (const item of items) {
    // Masqué (`display: none`) : boîte vide, jamais une case.
    if (item.getClientRects().length === 0) continue;
    const group = item.closest('[role="radiogroup"]');
    if (!group) {
      stops.push({ element: item, rect: item.getBoundingClientRect() });
      continue;
    }
    if (groups.has(group)) continue;
    groups.add(group);
    const element =
      focused instanceof HTMLElement && group.contains(focused)
        ? focused
        : (group.querySelector<HTMLElement>('[aria-checked="true"]') ?? item);
    stops.push({ element, rect: group.getBoundingClientRect() });
  }
  return stops;
};

/** Écart entre deux intervalles, 0 s'ils se chevauchent */
const gap = (a0: number, a1: number, b0: number, b1: number): number =>
  Math.max(0, b0 - a1, a0 - b1);

/**
 * Case la plus proche dans la direction voulue, d'après la mise en page à l'écran et non l'ordre du DOM :
 * haut et bas descendent dans la colonne, gauche et droite restent sur la ligne.
 */
const nearest = (
  from: DOMRect,
  stops: Stop[],
  action: "up" | "down" | "left" | "right",
): Stop | undefined => {
  let best: Stop | undefined;
  let bestScore = Infinity;
  for (const stop of stops) {
    const r = stop.rect;
    let main: number;
    let cross: number;
    if (action === "down" || action === "up") {
      main = action === "down" ? r.top - from.bottom : from.top - r.bottom;
      cross = gap(from.left, from.right, r.left, r.right);
    } else {
      // Même ligne seulement : sans chevauchement vertical, gauche et droite ne font rien.
      if (Math.min(from.bottom, r.bottom) - Math.max(from.top, r.top) <= 0)
        continue;
      main = action === "right" ? r.left - from.right : from.left - r.right;
      cross = 0;
    }
    if (main < -SLACK) continue;
    // Départage, sens de lecture : en haut/bas la case la plus à gauche (sous une rangée pleine largeur,
    // Compteur avant Mini-carte), en gauche/droite la plus proche en hauteur.
    const tie =
      action === "down" || action === "up"
        ? r.left
        : Math.abs(r.top + r.height / 2 - (from.top + from.height / 2));
    const score = Math.max(0, main) + cross * 2 + tie * 0.01;
    if (score < bestScore) {
      bestScore = score;
      best = stop;
    }
  }
  return best;
};

const focusStop = (element: HTMLElement): void => {
  element.focus();
  // Bandeau de cartes ou drawer qui défile : la case visée vient à l'écran sans sauter.
  element.scrollIntoView({ block: "nearest", inline: "nearest" });
};

/**
 * Manette : haut et bas descendent ou montent à la case la plus proche à l'écran, gauche et droite parcourent une rangée de choix,
 * sinon passent à la case voisine sur la même ligne, ou règlent un curseur. A clique sur ce qui a le focus.
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
  // Un panneau d'import ouvert dans le menu prend la main.
  const scope =
    list ??
    document.querySelector("dialog[open] dialog[open]") ??
    document.querySelector("dialog[open]");
  const items = [...(scope?.querySelectorAll<HTMLElement>(PAD_ITEMS) ?? [])];
  const focused = document.activeElement;
  if (action === "confirm") {
    const target = items.find((item) => item === focused) ?? items[0];
    if (!(soundBlocked && target?.dataset.needsSound !== undefined))
      target?.click();
    return;
  }
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
  const radioGroup =
    focused instanceof HTMLElement
      ? focused.closest('[role="radiogroup"]')
      : null;
  // Grille de choix (compteurs 2×2, mini-cartes) : haut et bas changent d'abord de rangée dans la grille,
  // et n'en sortent qu'au bord. Sans ça, bas sautait toute la grille d'un coup.
  if ((action === "up" || action === "down") && radioGroup) {
    const from = (focused as HTMLElement).getBoundingClientRect();
    const radios = [
      ...radioGroup.querySelectorAll<HTMLElement>('[role="radio"]'),
    ]
      .filter((radio) => radio !== focused)
      .map((element) => ({ element, rect: element.getBoundingClientRect() }));
    const inGroup = nearest(from, radios, action);
    // Seulement une vraie rangée plus bas ou plus haut, pas un voisin de la même ligne.
    if (
      inGroup &&
      (action === "down"
        ? inGroup.rect.top >= from.bottom - SLACK
        : inGroup.rect.bottom <= from.top + SLACK)
    ) {
      focusStop(inGroup.element);
      return;
    }
  }
  // Gauche et droite : voisin sur la même ligne de la grille, sinon on sort vers la case d'à côté
  // (grille Compteur → grille Mini-carte), plus bas par `nearest` sur les cases.
  if ((action === "left" || action === "right") && radioGroup) {
    const radios = [
      ...radioGroup.querySelectorAll<HTMLElement>('[role="radio"]'),
    ]
      .filter((radio) => radio !== focused)
      .map((element) => ({ element, rect: element.getBoundingClientRect() }));
    const inGroup = nearest(
      (focused as HTMLElement).getBoundingClientRect(),
      radios,
      action,
    );
    if (inGroup) {
      focusStop(inGroup.element);
      return;
    }
  }
  const stops = toStops(items, focused);
  const current = stops.find(({ element }) => element === focused);
  if (!current) {
    // Rien de focalisé dans le menu : bas part du haut, haut part du bas.
    if (action === "down") stops[0]?.element.focus();
    if (action === "up") stops[stops.length - 1]?.element.focus();
    return;
  }
  const others = stops.filter((stop) => stop !== current);
  const target = nearest(current.rect, others, action);
  if (target) {
    // On entre dans une grille de choix par la case la plus proche (en haut à gauche en descendant),
    // pas par le choix en cours : la manette suit l'écran, comme partout ailleurs.
    const group = target.element.closest('[role="radiogroup"]');
    const radios = group
      ? [...group.querySelectorAll<HTMLElement>('[role="radio"]')].map(
          (element) => ({ element, rect: element.getBoundingClientRect() }),
        )
      : [];
    focusStop(nearest(current.rect, radios, action)?.element ?? target.element);
    return;
  }
  // Au bout de la colonne, on boucle : bas repart de la case la plus haute, haut de la plus basse.
  if (action === "down" || action === "up") {
    const sorted = [...others].sort((a, b) =>
      action === "down"
        ? a.rect.top - b.rect.top
        : b.rect.bottom - a.rect.bottom,
    );
    const edge = sorted[0];
    if (!edge) return;
    const center = (rect: DOMRect): number => rect.left + rect.width / 2;
    // Sur la ligne du bord, la case la plus proche en colonne.
    const wrapped = sorted
      .filter(({ rect }) =>
        action === "down"
          ? rect.top <= edge.rect.top + SLACK
          : rect.bottom >= edge.rect.bottom - SLACK,
      )
      .reduce((a, b) =>
        Math.abs(center(b.rect) - center(current.rect)) <
        Math.abs(center(a.rect) - center(current.rect))
          ? b
          : a,
      );
    focusStop(wrapped.element);
  }
};
