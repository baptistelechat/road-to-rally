"use client";

import { Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useEditor } from "../../store";
import { ScorePanel } from "./ScorePanel";

const decimal = (value: number, digits: number): string =>
  value.toFixed(digits).replace(".", ",");

/** L'essentiel du score au-dessus de la courbe ; le détail dans une fenêtre. */
export const StatsStrip = () => {
  const stats = useEditor((state) => state.stats);
  const profile = useEditor((state) => state.profile);
  const items = [
    stats && `${decimal(stats.length / 1000, 2)} km`,
    stats && `${decimal(stats.turnsPerKm, 1)} virages/km`,
    profile && `↑ ${Math.round(profile.ascent)} m`,
    profile && `↓ ${Math.round(profile.descent)} m`,
    profile && `pente max ${Math.round(profile.maxSlope * 100)} %`,
  ].filter((item): item is string => Boolean(item));

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 pt-2 text-xs">
      {stats && (
        <strong className="font-semibold">Route {stats.verdict}</strong>
      )}
      {items.map((item) => (
        <span key={item} className="text-muted-foreground tabular-nums">
          {item}
        </span>
      ))}
      <Dialog>
        <DialogTrigger
          render={<Button variant="ghost" size="xs" className="ml-auto" />}
        >
          <Gauge aria-hidden="true" />
          Score détaillé
        </DialogTrigger>
        <DialogContent className="dark">
          <DialogTitle>Score de la spéciale</DialogTitle>
          <ScorePanel />
        </DialogContent>
      </Dialog>
    </div>
  );
};
