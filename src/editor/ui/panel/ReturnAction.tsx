"use client";

import { Undo, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEditor } from "../../store";

/** Depuis le dernier point : le retour recopie l'aller. Dans le panneau et dans la bulle du point. */
export const ReturnAction = () => {
  const hasRoute = useEditor(
    (state) => state.history.present.segments.length > 0,
  );
  const active = useEditor(
    (state) => state.history.present.returnRoute !== null,
  );
  const pending = useEditor((state) => state.status.pending);
  const returnByRoad = useEditor((state) => state.returnByRoad);
  const cancelReturn = useEditor((state) => state.cancelReturn);
  if (!hasRoute) return null;
  return active ? (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => void cancelReturn()}
    >
      <X aria-hidden="true" />
      Retirer le retour
    </Button>
  ) : (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      title="Faire le tour au dernier point, puis repartir par l'aller"
      onClick={() => void returnByRoad()}
    >
      <Undo aria-hidden="true" />
      Revenir par la même route
    </Button>
  );
};
