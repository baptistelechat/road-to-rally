"use client";

import { useMemo } from "react";
import { splitMarkers, type ProfileMarker } from "../profileMarkers";
import { useEditor } from "../store";

const NONE: ProfileMarker[] = [];

/** Intermédiaires de la course sur l'axe de l'éditeur. À plat tant que le profil d'altitude n'est pas arrivé. */
export const useSplits = (): ProfileMarker[] => {
  const axis = useEditor((state) => state.analysis?.axis ?? null);
  const altitudes = useEditor((state) => state.profile?.altitudes ?? null);
  return useMemo(
    () =>
      axis ? splitMarkers(axis.latLon, axis.runoffPoints, altitudes) : NONE,
    [axis, altitudes],
  );
};
