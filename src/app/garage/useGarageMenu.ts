import { type ActionDispatch, useEffect, useReducer } from "react";
import type { MenuAction } from "@/input/smoothing";
import { loadLivery, saveLivery } from "@/render/car/livery";
import {
  createGarageMenu,
  type GarageMenu,
  type GarageMenuEvent,
  stepGarageMenu,
} from "./garageMenu";

const KEY_ACTIONS: Partial<Record<string, MenuAction>> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  Enter: "confirm",
  Escape: "cancel",
};

export const useGarageMenu = (): [
  GarageMenu,
  ActionDispatch<[event: GarageMenuEvent]>,
] => {
  const [menu, dispatch] = useReducer(stepGarageMenu, undefined, () =>
    createGarageMenu(loadLivery()),
  );

  useEffect(() => saveLivery(menu.livery), [menu.livery]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const action = KEY_ACTIONS[event.key];
      if (!action) return;
      const active = document.activeElement;
      if (action === "confirm") {
        // Sur un bouton qui a le focus, Entrée déclenche déjà son clic.
        if (event.repeat || active instanceof HTMLButtonElement) return;
      } else if (active instanceof HTMLElement) {
        active.blur();
      }
      event.preventDefault();
      dispatch(action);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return [menu, dispatch];
};
