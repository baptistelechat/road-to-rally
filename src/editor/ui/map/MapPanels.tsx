"use client";

import { Info, ListOrdered, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useEditor } from "../../store";
import { ChicanePanel } from "../panel/ChicanePanel";
import { PointsPanel, RouteMessages } from "../panel/PointsPanel";
import { VariantPanel } from "../panel/VariantPanel";
import { RoadsToggle } from "./BasemapSwitch";
import {
  ChicaneSymbol,
  PointSymbol,
  MEDIAN_COLOR,
  RoundaboutSymbol,
  StraightSymbol,
} from "../symbols";
import { useChicanes } from "../useChicanes";

interface MapPopoverProps {
  label: string;
  icon: ReactNode;
  title: string;
  align?: "start" | "center" | "end";
  /** S'ouvre aussi au survol : une aide à lire, pas un panneau où l'on agit */
  openOnHover?: boolean;
  children: ReactNode;
}

const MapPopover = ({
  label,
  icon,
  title,
  align = "center",
  openOnHover = false,
  children,
}: MapPopoverProps) => (
  <Popover>
    <PopoverTrigger
      openOnHover={openOnHover}
      delay={150}
      render={<Button variant="ghost" size="sm" />}
    >
      {icon}
      {label}
    </PopoverTrigger>
    <PopoverContent
      align={align}
      className="dark max-h-[70vh] w-80 overflow-y-auto"
    >
      <PopoverTitle className="text-xs font-semibold text-muted-foreground uppercase">
        {title}
      </PopoverTitle>
      {children}
    </PopoverContent>
  </Popover>
);

/** Points et chicanes, au clavier comme à la souris : la carte seule ne suffit pas. */
export const ElementPanels = () => {
  const points = useEditor((state) => state.history.present.anchors.length);
  const chicanes = useChicanes().length;
  return (
    <div className="absolute top-2 left-1/2 z-10 flex -translate-x-1/2 gap-1 rounded-lg border bg-background p-1 shadow-md">
      <MapPopover
        label={`Points (${points})`}
        icon={<ListOrdered aria-hidden="true" />}
        title="Points"
      >
        <PointsPanel />
        <VariantPanel />
      </MapPopover>
      <MapPopover
        label={`Chicanes (${chicanes})`}
        icon={<TriangleAlert aria-hidden="true" />}
        title="Chicanes"
      >
        <ChicanePanel />
      </MapPopover>
    </div>
  );
};

const Line = ({ color, dashed }: { color: string; dashed?: boolean }) => (
  <span
    aria-hidden="true"
    className="inline-block h-0 w-6 shrink-0 border-t-[3px]"
    style={{ borderColor: color, borderStyle: dashed ? "dashed" : "solid" }}
  />
);

const Entry = ({
  swatch,
  children,
}: {
  swatch: ReactNode;
  children: ReactNode;
}) => (
  <li className="flex items-center gap-2">
    <span className="grid w-6 shrink-0 place-items-center">{swatch}</span>
    <span>{children}</span>
  </li>
);

/** Ce que veut dire chaque trait, et ce que fait chaque geste : à la demande, plus en permanence dans le panneau. */
export const Legend = () => (
  <div className="absolute top-14 right-2 z-10 flex gap-1 rounded-lg border bg-background p-1 shadow-md">
    <RoadsToggle />
    <MapPopover
      label="Légende"
      icon={<Info aria-hidden="true" />}
      title="Légende"
      align="end"
      openOnHover
    >
      <ul className="space-y-1.5 text-xs">
        <Entry swatch={<PointSymbol rank={1} size="sm" />}>
          Point : le premier est le départ, le dernier l&apos;arrivée
        </Entry>
        <Entry swatch={<Line color="#38bdf8" />}>La route réelle</Entry>
        <Entry swatch={<Line color="#f8fafc" />}>
          La route roulée (bleu nuit sur le fond clair)
        </Entry>
        <Entry swatch={<Line color="#e5e5e5" dashed />}>
          Au-delà des lignes, hors chrono
        </Entry>
        <Entry swatch={<Line color="#c084fc" />}>
          Roulée dans les deux sens
        </Entry>
        <Entry swatch={<Line color={MEDIAN_COLOR} />}>
          Glissière du terre-plein : aller et retour sur deux chaussées
        </Entry>
        <Entry swatch={<StraightSymbol size="sm" />}>
          Plus longue ligne droite, tracée en vert
        </Entry>
        <Entry swatch={<RoundaboutSymbol />}>
          Îlot d&apos;un rond-point, impossible à couper
        </Entry>
        <Entry swatch={<RoundaboutSymbol rock />}>
          Rocher au centre d&apos;un petit giratoire
        </Entry>
        <Entry swatch={<ChicaneSymbol side="left" size="sm" />}>
          Chicane, et sa place en jaune : rouge si elle en touche une autre
        </Entry>
        <Entry swatch={<ChicaneSymbol side="left" player size="sm" />}>
          Chicane que tu as placée
        </Entry>
      </ul>
      <PopoverTitle className="pt-1 text-xs font-semibold text-muted-foreground uppercase">
        Gestes
      </PopoverTitle>
      <ul className="list-disc space-y-1 pl-4 text-xs">
        <li>Clic sur une route : un point</li>
        <li>Glisser un point ou une chicane : le déplacer</li>
        <li>Glisser le tracé : un passage de plus</li>
        <li>Clic droit près du tracé : une chicane</li>
        <li>Clic sur un point ou une chicane : ses actions</li>
        <li>Ctrl+Z, Ctrl+Y : annuler, rétablir</li>
      </ul>
    </MapPopover>
  </div>
);

/** Calcul en cours, refus ou brouillon perdu : sur la carte, là où le regard se trouve. */
export const RouteStatus = () => (
  <div className="absolute bottom-10 left-1/2 z-10 w-max max-w-[calc(100%-6rem)] -translate-x-1/2">
    <RouteMessages />
  </div>
);

/** Tant que rien n'est posé : le premier geste, sans lire la légende. */
export const FirstHint = () => {
  const empty = useEditor(
    (state) => state.history.present.anchors.length === 0,
  );
  if (!empty) return null;
  return (
    <p className="pointer-events-none absolute top-16 left-1/2 z-10 -translate-x-1/2 rounded-lg border bg-background px-3 py-2 text-sm shadow-md">
      Clique sur une route pour poser le départ.
    </p>
  );
};
