"use client";

import { useEffect, useState } from "react";
import { FLAGS, loadFlagImages, NO_FLAG } from "@/render/car/flags";
import { loadLivery } from "@/render/car/livery";

/** Drapeau et numéro choisis au garage, ceux que porte la voiture. Drapeau en premier : à gauche, ou au-dessus avec `stacked`. */
export const DriverBadge = ({ stacked = false }: { stacked?: boolean }) => {
  // Lue une fois : le garage est une autre page, la livrée ne change pas en course.
  const [{ numberText, flag }] = useState(loadLivery);
  const [flagUrl, setFlagUrl] = useState<string | null>(null);

  useEffect(() => {
    if (flag === NO_FLAG) return;
    let alive = true;
    loadFlagImages()
      .then((images) => {
        if (alive) setFlagUrl(images[flag] ?? null);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [flag]);

  const country = FLAGS.find(({ id }) => id === flag)?.label;
  return (
    <div
      role="group"
      aria-label={`Voiture ${numberText}${country && flag !== NO_FLAG ? `, ${country}` : ""}`}
      className={`flex shrink-0 items-stretch ${stacked ? "w-12.5 flex-col" : "h-11.5"}`}
    >
      {flag !== NO_FLAG && (
        // Petit drapeau sur fond sombre, comme la maquette R-HUD-Broadcast.
        <span
          className={`flex shrink-0 items-center justify-center bg-background ${stacked ? "py-2" : "px-3"}`}
        >
          {flagUrl ? (
            // URL data d'un petit SVG : `next/image` n'apporterait rien.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={flagUrl} alt="" className="h-5 w-7.5" />
          ) : (
            <span className="h-5 w-7.5" />
          )}
        </span>
      )}
      <span
        className={`grid place-items-center bg-foreground font-mono text-2xl text-background ${stacked ? "h-10.5" : "min-w-12.5 px-2"}`}
      >
        {numberText}
      </span>
    </div>
  );
};
