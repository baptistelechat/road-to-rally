"use client";

import { useMemo } from "react";
import { unproject, type LatLon } from "@/geo/gpx";
import { useEditor } from "../store";

const NONE: LatLon[][] = [];

/** Glissières des terre-pleins de l'analyse en cours, en coordonnées GPS. Vide sans aller-retour en milieu de spéciale. */
export const useMedians = (): LatLon[][] => {
  const axis = useEditor((state) => state.analysis?.axis ?? null);
  return useMemo(
    () =>
      axis?.dual
        ? axis.dual
            .filter(({ barrier }) => barrier.length > 1)
            .map(({ barrier }) => barrier.map((p) => unproject(p, axis.origin)))
        : NONE,
    [axis],
  );
};
