import { type ActionDispatch, useCallback, useEffect, useReducer } from "react";
import type { MenuAction } from "@/input/smoothing";
import { loadLivery, saveLivery } from "@/render/car/livery";
import {
  createGarageMenu,
  type GarageMenu,
  type GarageMenuEvent,
  stepGarageMenu,
} from "./garageMenu";
import { useEngineDemo } from "./useEngineDemo";

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

  const endDemo = useCallback(() => dispatch({ type: "demoEnd" }), []);
  useEngineDemo(menu.engineDemo, endDemo);

  const typing = menu.text !== null;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const typed = event.key.length === 1 || event.key === "Backspace";
      if (typing && typed && !event.ctrlKey && !event.metaKey) {
        // Sinon, Espace activerait le bouton qui a gardé le focus après un clic.
        if (document.activeElement instanceof HTMLElement)
          document.activeElement.blur();
        event.preventDefault();
        dispatch(
          event.key === "Backspace"
            ? { type: "erase" }
            : { type: "char", char: event.key },
        );
        return;
      }
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
  }, [typing]);

  return [menu, dispatch];
};
