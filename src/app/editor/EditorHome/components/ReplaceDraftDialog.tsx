"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ReplaceDraftDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Un brouillon jamais roulé serait perdu sans retour : on demande d'abord. */
export const ReplaceDraftDialog = ({
  open,
  onCancel,
  onConfirm,
}: ReplaceDraftDialogProps) => (
  <AlertDialog
    open={open}
    onOpenChange={(next) => {
      if (!next) onCancel();
    }}
  >
    {/* Rendue hors de la page, dans `body` : le thème sombre ne l'atteint pas tout seul. */}
    <AlertDialogContent className="dark">
      <AlertDialogHeader>
        <AlertDialogTitle>Abandonner le tracé en cours ?</AlertDialogTitle>
        <AlertDialogDescription>
          Le tracé ouvert dans l&apos;éditeur contient des changements qui
          n&apos;ont pas été roulés. Ils seront définitivement perdus.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Annuler</AlertDialogCancel>
        <AlertDialogAction variant="destructive" onClick={onConfirm}>
          Abandonner et continuer
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
