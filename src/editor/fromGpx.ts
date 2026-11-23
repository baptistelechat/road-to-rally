// Un GPX importé devient un tracé d'éditeur : il se rouvre et se modifie comme une spéciale tracée sur la carte.
import type { LatLon } from "@/geo/gpx";
import { distance } from "./trace";
import {
  EMPTY_TRACE,
  type Anchor,
  type EditorTrace,
  type Segment,
} from "./types";

/** Écart visé entre deux points d'ancrage, en mètres : assez pour garder la route du GPX, assez peu pour la reprendre à la main */
const ANCHOR_SPACING = 1000;

/**
 * Le GPX est gardé point par point entre les ancrages : rien n'est recalculé par BRouter tant que le joueur ne déplace pas un point.
 * ponytail: segments sans voies OSM (`ways` vide) ; la génération les retrouve dans la BD TOPO comme pour tout GPX.
 */
export const traceFromGpx = (points: LatLon[], name: string): EditorTrace => {
  const cuts = [0];
  let run = 0;
  for (let i = 1; i < points.length; i++) {
    run += distance(points[i - 1], points[i]);
    if (run >= ANCHOR_SPACING && i < points.length - 1) {
      cuts.push(i);
      run = 0;
    }
  }
  cuts.push(points.length - 1);
  const anchors: Anchor[] = cuts.map((index, i) => ({
    id: `a${i + 1}`,
    position: points[index],
  }));
  const segments: Segment[] = cuts.slice(1).map((to, i) => {
    const slice = points.slice(cuts[i], to + 1);
    return {
      fromAnchorId: anchors[i].id,
      toAnchorId: anchors[i + 1].id,
      points: slice,
      ways: [],
      length: slice.reduce(
        (sum, point, k) => (k === 0 ? 0 : sum + distance(slice[k - 1], point)),
        0,
      ),
    };
  });
  return { ...EMPTY_TRACE, name, anchors, segments };
};
