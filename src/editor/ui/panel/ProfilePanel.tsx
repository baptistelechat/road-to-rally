"use client";

import { useCallback } from "react";
import { editorStore, useEditor } from "../../store";
import { ElevationChart } from "../ElevationChart";

/** La hauteur est réservée : le graphique arrive sans faire sauter la carte. */
const placeholder =
  "grid h-40 place-items-center px-4 text-center text-sm text-muted-foreground";

/** Seul ce composant suit le curseur : la courbe, mémorisée, ne se redessine pas. */
export const ProfilePanel = () => {
  const profile = useEditor((state) => state.profile);
  const status = useEditor((state) => state.profileStatus);
  const message = useEditor((state) => state.profileMessage);
  const cursorS = useEditor((state) => state.hoverS);
  const handleHover = useCallback(
    (hoverS: number | null) => editorStore.setState({ hoverS }),
    [],
  );

  if (profile)
    return (
      <ElevationChart
        abscissas={profile.abscissas}
        altitudes={profile.altitudes}
        startS={profile.startS}
        finishS={profile.finishS}
        cursorS={cursorS}
        onHover={handleHover}
        className="px-2 py-1"
      />
    );

  return (
    <div role="status" className={placeholder}>
      {status === "failed" || status === "outOfFrance"
        ? `Profil d'altitude indisponible. ${message ?? ""}`
        : "Calcul du profil d'altitude…"}
    </div>
  );
};
