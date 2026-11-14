"use client";

import { useEffect, useState } from "react";

/** Durée d'affichage du GO une fois le décompte fini, en ms */
const GO_MS = 800;
/** Feux du départ, qui répondent aux lampes de l'arche */
const LIGHTS = [1, 2, 3] as const;
const HEXAGON =
  "[clip-path:polygon(50%_0,100%_22%,100%_78%,50%_100%,0_78%,0_22%)]";

interface CountdownProps {
  /** Secondes restantes avant le GO, `null` une fois parti */
  seconds: number | null;
}

/** Décompte du départ arrêté : 3, 2, 1 puis GO dans un hexagone. La zone reste montée pour que chaque chiffre soit annoncé. */
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

  const count = seconds === null ? null : Math.max(1, Math.ceil(seconds));
  // 3 → un feu, 2 → deux, 1 → trois, GO → tous.
  const lit = count === null ? LIGHTS.length : LIGHTS.length + 1 - count;
  const text = count !== null ? String(count) : go ? "GO" : null;
  const isGo = text === "GO";

  return (
    <div
      aria-live="assertive"
      aria-atomic="true"
      className="absolute top-1/3 left-1/2 -translate-x-1/2"
    >
      {text && (
        <div
          key={text}
          className={`flex h-[168px] w-[150px] flex-col items-center justify-center gap-2.5 transition-opacity duration-200 starting:opacity-0 ${HEXAGON} ${isGo ? "bg-chart-4" : "bg-background/90"}`}
        >
          <span aria-hidden="true" className="flex gap-2">
            {LIGHTS.map((light) => (
              <span
                key={light}
                className={`size-3.5 rounded-full ${isGo ? "bg-background" : light <= lit ? "bg-destructive" : "bg-foreground/15"}`}
              />
            ))}
          </span>
          {isGo ? (
            <span className="font-display text-[44px] leading-none text-background">
              GO
            </span>
          ) : (
            <span className="font-mono text-[84px] leading-[0.9] text-brand tabular-nums">
              {text}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
