"use client";

import { Pencil, Play, Trash2 } from "lucide-react";
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
import { Button, buttonVariants } from "@/components/ui/button";
import { customStageUrl } from "@/game/maps";
import type { StoredStage } from "@/game/stageCache";

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
    : `, ${date.toLocaleDateString("fr-FR", { dateStyle: "long" })}`;
  return `${km} km, ${count}${day}`;
};

interface StageRowProps {
  stage: StoredStage;
  /** Le brouillon contient des changements de cette spéciale, pas encore roulés */
  hasUnrolledChanges: boolean;
  /** Absent : aucun tracé rangé avec cette spéciale */
  onEdit?: () => void;
  onDelete: () => void;
}

export const StageRow = ({
  stage,
  hasUnrolledChanges,
  onEdit,
  onDelete,
}: StageRowProps) => (
  <li className="flex items-center gap-2 border-b py-3">
    <div className="min-w-0 flex-1">
      <h3 className="truncate text-sm font-medium">{stage.name}</h3>
      <p className="text-xs text-muted-foreground">{describe(stage)}</p>
      {hasUnrolledChanges && (
        <p className="text-xs text-amber-400">
          Des modifications attendent d&apos;être roulées.
        </p>
      )}
      {!onEdit && (
        <p className="text-xs text-muted-foreground">
          Importée ou créée avant l&apos;édition : son tracé n&apos;a pas été
          gardé, elle ne peut pas être modifiée.
        </p>
      )}
      {stage.outdated && (
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
    {onEdit && (
      <Button variant="outline" size="sm" onClick={onEdit}>
        <Pencil aria-hidden="true" />
        Modifier
      </Button>
    )}
    {/* Une vraie navigation : la scène 3D n'ouvre son contexte WebGL que sur une page neuve. */}
    <a
      href={customStageUrl(stage.key)}
      className={buttonVariants({ size: "sm" })}
    >
      <Play aria-hidden="true" />
      Rouler
    </a>
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="destructive"
            size="icon-sm"
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
            Cette spéciale sera définitivement effacée de ce navigateur, et son
            lien ne fonctionnera plus. Cette action est irréversible.
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
  </li>
);
