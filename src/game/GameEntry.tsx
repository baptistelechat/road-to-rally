"use client";

import dynamic from "next/dynamic";

const Game = dynamic(() => import("./Game").then((mod) => mod.Game), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 grid place-items-center bg-neutral-900 text-neutral-400">
      Chargement…
    </div>
  ),
});

// Un portable tactile ou une tablette n'a aucun pointeur précis. Un PC à écran tactile en a un.
const isTouchOnly = (): boolean =>
  window.matchMedia("(pointer: coarse)").matches &&
  !window.matchMedia("(any-pointer: fine)").matches;

/** Choisi côté client : ce module ne charge ni Three.js ni Rapier sur un téléphone. */
export const GameEntry = () =>
  isTouchOnly() ? (
    <main className="fixed inset-0 grid place-items-center bg-neutral-900 p-8 text-center">
      <div className="max-w-sm space-y-3">
        <h1 className="text-2xl font-semibold">Rally se joue sur ordinateur</h1>
        <p className="text-neutral-400">
          Ouvre cette page sur un PC, avec un clavier ou une manette.
        </p>
      </div>
    </main>
  ) : (
    <Game />
  );
