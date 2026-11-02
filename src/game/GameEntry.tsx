"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { GeneratedStage } from "@/geo/stageWorkerClient";
import { CUSTOM_MAP_ID, EDITOR_URL } from "./maps";

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

const screen =
  "fixed inset-0 grid place-items-center bg-neutral-900 p-8 text-center text-neutral-400";

/** Relit la spéciale de l'éditeur avant de monter le jeu : une clé absente ou illisible ne le plante pas. */
const CustomStage = () => {
  // `undefined` : pas encore relue. `null` : absente.
  const [stage, setStage] = useState<GeneratedStage | null | undefined>();

  useEffect(() => {
    let cancelled = false;
    const key = new URLSearchParams(window.location.search).get("stage");
    // Import différé : ce module ne charge rien de plus sur un téléphone.
    void import("./stageCache")
      .then(({ readCustomStage }) => (key ? readCustomStage(key) : null))
      .catch(() => null)
      .then((read) => {
        if (!cancelled) setStage(read);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (stage) return <Game initialStage={stage} />;
  if (stage === undefined)
    return (
      <div role="status" className={screen}>
        Chargement de la spéciale…
      </div>
    );
  return (
    <div role="alert" className={screen}>
      <div className="max-w-sm space-y-3">
        <p>
          Cette spéciale n&apos;est plus disponible dans ce navigateur. Ton
          tracé est toujours dans l&apos;éditeur : relance-le avec « Rouler ».
        </p>
        <a
          href={EDITOR_URL}
          className="font-semibold text-amber-400 underline focus-visible:outline-2 focus-visible:outline-amber-400"
        >
          Retour à l&apos;éditeur
        </a>
      </div>
    </div>
  );
};

/** Choisi côté client : ce module ne charge ni Three.js ni Rapier sur un téléphone. */
export const GameEntry = () => {
  if (isTouchOnly())
    return (
      <main className="fixed inset-0 grid place-items-center bg-neutral-900 p-8 text-center">
        <div className="max-w-sm space-y-3">
          <h1 className="text-2xl font-semibold">
            Rally se joue sur ordinateur
          </h1>
          <p className="text-neutral-400">
            Ouvre cette page sur un PC, avec un clavier ou une manette.
          </p>
        </div>
      </main>
    );
  const custom =
    new URLSearchParams(window.location.search).get("map") === CUSTOM_MAP_ID;
  return custom ? <CustomStage /> : <Game />;
};
