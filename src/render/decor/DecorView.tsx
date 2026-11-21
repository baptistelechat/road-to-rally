"use client";

import { useCallback } from "react";
import type { CarSource } from "@/render/carSource";
import type { Track } from "@/sim/types";
import { BridgesView } from "./BridgesView";
import { BuildingsView } from "./BuildingsView";
import { WaterView } from "./WaterView";

interface DecorViewProps {
  track: Track;
  /** La voiture : seules les tranches de bâtiments proches se dessinent */
  source: CarSource;
}

/** Décor réel hors arbres : les arbres passent par la simulation (`generateScenery`) et `SceneryView`. */
export const DecorView = ({ track, source }: DecorViewProps) => {
  // Même référence tant que la piste ne change pas : la géométrie des bâtiments n'est pas recalculée à chaque rendu.
  const roadClearance = useCallback(
    (x: number, z: number): number => {
      const sample = track.nearest(x, z);
      return sample.distance - sample.width / 2;
    },
    [track],
  );
  const { decor } = track;
  // Les ponts ne dépendent pas des données de décor : ils viennent des routes.
  if (!decor) return <BridgesView track={track} />;
  // ponytail: l'eau reste un seul maillage plat, un appel de dessin ; à découper si elle pèse au profileur.
  return (
    <group>
      <BuildingsView
        buildings={decor.buildings}
        roadClearance={roadClearance}
        track={track}
        source={source}
      />
      <WaterView water={decor.water} source={source} waterAt={track.waterAt} />
      <BridgesView track={track} />
    </group>
  );
};
