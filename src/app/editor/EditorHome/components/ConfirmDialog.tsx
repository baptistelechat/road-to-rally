"use client";

import type { ReactElement, ReactNode } from "react";
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

interface ConfirmDialogProps {
  /** Le bouton qui ouvre la confirmation, sans son contenu */
  trigger: ReactElement;
  /** Contenu du bouton : texte ou icône */
  children: ReactNode;
  title: ReactNode;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
}

/** Une action destructive de l'éditeur, confirmée avant d'agir. */
export const ConfirmDialog = ({
  trigger,
  children,
  title,
  description,
  confirmLabel,
  onConfirm,
}: ConfirmDialogProps) => (
  <AlertDialog>
    <AlertDialogTrigger render={trigger}>{children}</AlertDialogTrigger>
    {/* Rendue hors de la page, dans `body` : le thème sombre ne l'atteint pas tout seul. */}
    <AlertDialogContent className="dark">
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Annuler</AlertDialogCancel>
        <AlertDialogAction variant="destructive" onClick={onConfirm}>
          {confirmLabel}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
