"use client";

import { useCallback, useMemo } from "react";
import type { LatLon } from "@/geo/gpx";
import { EDITOR_CHICANE_MIN_GAP, STEP } from "@/geo/config";
import {
  anchorMarkers,
  medianBands,
  roundaboutBands,
  type ProfileBand,
} from "../../profileMarkers";
import { axisIndex, editorStore, useEditor } from "../../store";
import { ElevationChart } from "../ElevationChart";
import { useChicanes } from "../useChicanes";
import { useMedians } from "../useMedians";
import { StatsStrip } from "./StatsStrip";

/** La hauteur est réservée : le graphique arrive sans faire sauter la carte. */
const placeholder =
  "grid h-40 place-items-center px-4 text-center text-sm text-muted-foreground";

const NONE: [] = [];

/** Seul ce composant suit le curseur : la courbe, mémorisée, ne se redessine pas. */
export const ProfilePanel = () => {
  const profile = useEditor((state) => state.profile);
  const status = useEditor((state) => state.profileStatus);
  const message = useEditor((state) => state.profileMessage);
  const cursorS = useEditor((state) => state.hoverS);
  const axis = useEditor((state) => state.analysis?.axis?.latLon ?? null);
  const roundabouts = useEditor((state) => state.analysis?.roundabouts ?? NONE);
  const anchors = useEditor((state) => state.history.present.anchors);
  const chicanes = useChicanes();
  const medians = useMedians();
  const handleHover = useCallback(
    (hoverS: number | null) => editorStore.setState({ hoverS }),
    [],
  );
  const handleFocus = useCallback(
    (position: LatLon) => editorStore.setState({ focus: { position } }),
    [],
  );

  const markers = useMemo(
    () =>
      axis
        ? [
            ...anchorMarkers(
              axis,
              anchors.map(({ position }) => position),
            ),
            ...chicanes.map((chicane, i) => ({
              kind: "chicane" as const,
              s: chicane.index * STEP,
              label: `Chicane ${i + 1}`,
              position: chicane.position,
              side: chicane.side,
              player: chicane.origin === "player",
            })),
          ]
        : NONE,
    [axis, anchors, chicanes],
  );
  const straight = useEditor((state) => state.stats?.longestStraight);
  // Les bandes larges d'abord : une chicane ou un rond-point reste cliquable par-dessus la ligne droite.
  const bands = useMemo((): ProfileBand[] => {
    if (!axis) return NONE;
    const reach = EDITOR_CHICANE_MIN_GAP / 2;
    return [
      ...(straight
        ? [
            {
              kind: "straight" as const,
              fromS: straight.fromS,
              toS: straight.toS,
              label: `Plus longue ligne droite, ${Math.round(straight.length)} m,`,
              position:
                axis[
                  axisIndex((straight.fromS + straight.toS) / 2, axis.length)
                ],
            },
          ]
        : []),
      ...chicanes.map((chicane, i) => ({
        kind: "chicane" as const,
        fromS: chicane.index * STEP - reach,
        toS: chicane.index * STEP + reach,
        label: `Zone de la chicane ${i + 1}`,
        position: chicane.position,
      })),
      ...roundaboutBands(axis, roundabouts),
      ...medianBands(axis, medians),
    ];
  }, [axis, roundabouts, chicanes, straight, medians]);

  if (profile)
    return (
      <>
        <StatsStrip />
        <ElevationChart
          abscissas={profile.abscissas}
          altitudes={profile.altitudes}
          startS={profile.startS}
          finishS={profile.finishS}
          cursorS={cursorS}
          onHover={handleHover}
          markers={markers}
          bands={bands}
          onFocus={handleFocus}
          className="px-2 py-1"
        />
      </>
    );

  return (
    <div role="status" className={placeholder}>
      {status === "failed" || status === "outOfFrance"
        ? `Profil d'altitude indisponible. ${message ?? ""}`
        : "Calcul du profil d'altitude…"}
    </div>
  );
};
