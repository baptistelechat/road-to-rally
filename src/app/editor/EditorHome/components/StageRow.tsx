"use client";

import { Play, RefreshCw, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { parseTrace } from "@/editor/draft";
import { customStageUrl } from "@/game/maps";
import type { StoredStage } from "@/game/stageCache";
import { StageThumbnail } from "./StageThumbnail";

const describe = ({ length, chicanes, generatedAt }: StoredStage): string => {
  const km = (length / 1000).toFixed(2).replace(".", ",");
  const count =
    chicanes === 0
      ? "sans chicane"
      : chicanes === 1
        ? "1 chicane"
        : `${chicanes} chicanes`;
  const date = new Date(generatedAt);
  const day = Number.isNaN(date.getTime())
    ? ""
    : ` · ${date.toLocaleDateString("fr-FR", { dateStyle: "long" })}`;
  return `${km} km · ${count}${day}`;
};

interface StageRowProps {
  stage: StoredStage;
  /** Le brouillon contient des changements de cette spéciale, pas encore roulés */
  hasUnrolledChanges: boolean;
  /** Absent : aucun tracé rangé avec cette spéciale */
  onEdit?: () => void;
  /** Absent : spéciale à jour, ou sans tracé à régénérer */
  onRegenerate?: () => void;
  onDelete: () => void;
}

/** Une spéciale rangée, en carte : la vignette du tracé, ses chiffres, puis rouler, modifier, supprimer. */
export const StageRow = ({
  stage,
  hasUnrolledChanges,
  onEdit,
  onRegenerate,
  onDelete,
}: StageRowProps) => (
  <li className="flex flex-col overflow-hidden rounded-lg border bg-card">
    <div className="relative">
      <StageThumbnail
        trace={parseTrace(stage.trace)}
        highlighted={hasUnrolledChanges}
        className="h-[150px] w-full"
      />
      {/* Générée par une ancienne version : le point répond au bouton jaune de régénération. */}
      {stage.outdated && (
        <span
          aria-hidden="true"
          className="absolute top-3 right-3 size-2.5 rounded-full bg-brand"
        />
      )}
    </div>
    <div className="flex flex-1 flex-col gap-1 px-4 py-3.5">
      <h3 className="truncate text-[1.0625rem] font-extrabold">{stage.name}</h3>
      <p className="font-mono text-[0.8125rem] text-muted-foreground">
        {describe(stage)}
      </p>
      {hasUnrolledChanges && (
        <p className="text-xs font-semibold text-brand">
          Des modifications attendent d&apos;être roulées.
        </p>
      )}
      {!onEdit && (
        <p className="text-xs text-muted-foreground">
          Importée ou créée avant l&apos;édition : son tracé n&apos;a pas été
          gardé, elle ne peut pas être modifiée.
        </p>
      )}
      {stage.outdated && !onRegenerate && (
        <p className="text-xs text-muted-foreground">
          Générée par une ancienne version du jeu : les derniers réglages de la
          génération ne s&apos;y appliquent pas.
        </p>
      )}
      {stage.degraded && (
        <p className="text-xs text-muted-foreground">
          Générée sans toutes les données de routes.
        </p>
      )}
    </div>
    <div className="flex gap-2 px-4 pb-4">
      {/* Une vraie navigation : la scène 3D n'ouvre son contexte WebGL que sur une page neuve. */}
      <Button
        size="xl"
        className="flex-1"
        nativeButton={false}
        render={<a href={customStageUrl(stage.key)} />}
      >
        <Play aria-hidden="true" />
        Rouler
      </Button>
      {onRegenerate && (
        <Button
          variant="attention"
          size="icon-xl"
          onClick={onRegenerate}
          aria-label={`Régénérer ${stage.name} avec la dernière version`}
          title="Régénérer avec la dernière version"
        >
          <RefreshCw aria-hidden="true" />
        </Button>
      )}
      {onEdit && (
        <Button variant="outline" size="xl" onClick={onEdit}>
          Modifier
        </Button>
      )}
      <AlertDialog>
        <AlertDialogTrigger
          render={
            <Button
              variant="destructive"
              size="icon-xl"
              aria-label={`Supprimer ${stage.name}`}
              title={`Supprimer ${stage.name}`}
            />
          }
        >
          <Trash2 aria-hidden="true" />
        </AlertDialogTrigger>
        {/* Rendue hors de la page, dans `body` : le thème sombre ne l'atteint pas tout seul. */}
        <AlertDialogContent className="dark">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer « {stage.name} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette spéciale sera définitivement effacée de ce navigateur, et
              son lien ne fonctionnera plus. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onDelete}>
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  </li>
);
