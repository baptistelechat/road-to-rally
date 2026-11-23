"use client";

import { Upload } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { traceFromGpx } from "@/editor/fromGpx";
import { StageImportPanel } from "@/game/Hud/components/StageImportPanel";
import { customStageUrl } from "@/game/maps";
import { storeCustomStage } from "@/game/stageCache";
import type { LoadedStage } from "@/game/useStageImport";
import { parseGpx } from "@/geo/gpx";

interface ImportGpxButtonProps {
  onError: (message: string) => void;
}

/** Un GPX importé rejoint « Mes spéciales » et part au volant, avec un tracé d'éditeur pour le modifier plus tard. */
export const ImportGpxButton = ({ onError }: ImportGpxButtonProps) => {
  const [open, setOpen] = useState(false);

  // Stable : un nouveau callback relancerait la génération en cours.
  const handleReady = useCallback(
    (loaded: LoadedStage): void => {
      setOpen(false);
      const points = parseGpx(loaded.gpx);
      // Sans points de trace lisibles, la spéciale se roule quand même, sans tracé à modifier.
      const trace =
        points.length >= 2
          ? traceFromGpx(points, loaded.stage.name)
          : undefined;
      void storeCustomStage(loaded.gpx, loaded, trace).then((key) => {
        if (key) window.location.assign(customStageUrl(key));
        else
          onError(
            "La spéciale n'a pas pu être enregistrée dans ce navigateur (navigation privée ou stockage plein).",
          );
      });
    },
    [onError],
  );

  return (
    <>
      <Button
        variant="outline"
        size="xl"
        font="display"
        onClick={() => setOpen(true)}
      >
        <Upload aria-hidden="true" />
        Importer un GPX
      </Button>
      {open && (
        <StageImportPanel
          onClose={() => setOpen(false)}
          onReady={handleReady}
        />
      )}
    </>
  );
};
