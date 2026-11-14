import { Button } from "@/components/ui/button";
import type { EditorTrace } from "@/editor/types";
import { capsLabel } from "@/editor/ui/styles";
import { EDITOR_TRACE_URL } from "@/game/maps";
import { cn } from "@/lib/utils";
import { StageThumbnail } from "./StageThumbnail";

/** Le brouillon qui n'est encore lié à aucune spéciale : on le reprend là où on l'a laissé. */
export const DraftBanner = ({ trace }: { trace: EditorTrace }) => {
  const points = trace.anchors.length;
  return (
    <section
      aria-label="Tracé en cours"
      className="flex items-center gap-5 rounded-lg border border-brand bg-card px-5 py-4"
    >
      <StageThumbnail
        trace={trace}
        highlighted
        dashed
        className="h-14 w-30 shrink-0 bg-background"
      />
      <div className="min-w-0 flex-1">
        <p className={cn(capsLabel, "text-brand uppercase")}>Tracé en cours</p>
        {trace.name && <p className="truncate font-extrabold">{trace.name}</p>}
        <p className="text-[0.8125rem] text-muted-foreground">
          {points} point{points > 1 ? "s" : ""} posé{points > 1 ? "s" : ""}, pas
          encore roulé
        </p>
      </div>
      <Button
        variant="secondary"
        size="xl"
        nativeButton={false}
        render={<a href={EDITOR_TRACE_URL} />}
      >
        Reprendre
      </Button>
    </section>
  );
};
