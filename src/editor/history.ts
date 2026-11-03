// Annuler et rétablir par instantanés immuables : ils partagent leurs segments intacts, la mémoire reste faible.

export interface History<T> {
  past: readonly T[];
  present: T;
  future: readonly T[];
}

export const createHistory = <T>(present: T): History<T> => ({
  past: [],
  present,
  future: [],
});

// ponytail: historique sans limite, une session d'édition reste petite ; borner `past` si la mémoire se plaint.
export const pushHistory = <T>(history: History<T>, next: T): History<T> =>
  next === history.present
    ? history
    : { past: [...history.past, history.present], present: next, future: [] };

export const undo = <T>(history: History<T>): History<T> =>
  history.past.length === 0
    ? history
    : {
        past: history.past.slice(0, -1),
        present: history.past[history.past.length - 1],
        future: [history.present, ...history.future],
      };

export const redo = <T>(history: History<T>): History<T> =>
  history.future.length === 0
    ? history
    : {
        past: [...history.past, history.present],
        present: history.future[0],
        future: history.future.slice(1),
      };

export const canUndo = <T>(history: History<T>): boolean =>
  history.past.length > 0;

export const canRedo = <T>(history: History<T>): boolean =>
  history.future.length > 0;
