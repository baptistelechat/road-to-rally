"use client";

import { useMemo } from "react";
import { MapRoute } from "@/components/ui/map";
import { toCoordinates } from "../../hover";
import { useEditor } from "../../store";
import type { RouteVariant } from "../../variants";

/** Une couleur par rang dans la liste du panneau, qui l'affiche aussi. */
export const VARIANT_COLORS = ["#f472b6", "#34d399", "#facc15", "#60a5fa"];

const NONE: RouteVariant[] = [];

const VariantRoute = ({
  rank,
  variant,
}: {
  rank: number;
  variant: RouteVariant;
}) => {
  const coordinates = useMemo(() => toCoordinates(variant.points), [variant]);
  return (
    <MapRoute
      id={`variant-${variant.alternativeIdx}`}
      coordinates={coordinates}
      color={VARIANT_COLORS[rank % VARIANT_COLORS.length]}
      width={4}
      opacity={0.95}
      dashArray={[2, 2]}
      interactive={false}
    />
  );
};

export const VariantRoutes = () => {
  const variants = useEditor((state) =>
    state.variants?.kind === "done" ? state.variants.variants : NONE,
  );
  return variants.map((variant, rank) => (
    <VariantRoute key={variant.alternativeIdx} rank={rank} variant={variant} />
  ));
};
