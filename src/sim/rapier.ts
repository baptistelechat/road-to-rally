import RAPIER from "@dimforge/rapier3d-deterministic-compat";

let ready: Promise<void> | null = null;

// Le WASM est embarqué dans le paquet : à attendre une seule fois avant de créer un monde.
export const initRapier = (): Promise<void> => {
  ready ??= RAPIER.init();
  return ready;
};

export { RAPIER };
