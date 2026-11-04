"use client";

import { useEffect, useState } from "react";
import { panel } from "../hudStyles";

/** Durée d'affichage du GO une fois le décompte fini, en ms */
const GO_MS = 800;

interface CountdownProps {
  /** Secondes restantes avant le GO, `null` une fois parti */
  seconds: number | null;
}

/** Décompte du départ arrêté : 3, 2, 1 puis GO. La zone reste montée pour que chaque chiffre soit annoncé. */
export const Countdown = ({ seconds }: CountdownProps) => {
  const [previous, setPrevious] = useState(seconds);
  const [go, setGo] = useState(false);
  // Seulement à la fin d'un décompte : pas de GO au montage ni sur le circuit.
  if (seconds !== previous) {
    setPrevious(seconds);
    setGo(seconds === null);
  }

  useEffect(() => {
    if (!go) return;
    const timer = setTimeout(() => setGo(false), GO_MS);
    return () => clearTimeout(timer);
  }, [go]);

  let text: string | null = null;
  if (seconds !== null) text = String(Math.max(1, Math.ceil(seconds)));
  else if (go) text = "GO";

  return (
    <div
      aria-live="assertive"
      aria-atomic="true"
      className="absolute top-1/3 left-1/2 -translate-x-1/2"
    >
      {text && (
        <div
          key={text}
          className={`${panel} min-w-28 px-6 py-3 text-center font-mono text-7xl font-bold tabular-nums transition-opacity duration-200 starting:opacity-0 ${text === "GO" ? "text-emerald-400" : "text-amber-400"}`}
        >
          {text}
        </div>
      )}
    </div>
  );
};
