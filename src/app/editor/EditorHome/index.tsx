"use client";

import { ArrowLeft, Pencil, Plus } from "lucide-react";
import { useEffect, useState } from "react";
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
import { Button, buttonVariants } from "@/components/ui/button";
import {
  clearDraft,
  parseTrace,
  readDraft,
  readDraftStage,
  writeDraft,
  writeDraftStage,
} from "@/editor/draft";
import type { EditorTrace } from "@/editor/types";
import { EDITOR_TRACE_URL } from "@/game/maps";
import {
  deleteStoredStage,
  listStoredStages,
  type StoredStage,
} from "@/game/stageCache";
import { StageRow } from "./components/StageRow";

// Une vraie navigation : la page de destination relit le brouillon, et la scène 3D démarre sur une page neuve.
const GAME_URL = "/";

interface Draft {
  trace: EditorTrace;
  stageKey: string | null;
}

const sameTrace = (stored: unknown, draft: EditorTrace): boolean =>
  JSON.stringify(parseTrace(stored)) === JSON.stringify(parseTrace(draft));

const openTrace = (): void => window.location.assign(EDITOR_TRACE_URL);

/** Point d'entrée de l'éditeur : créer une spéciale, ou reprendre une de celles rangées dans IndexedDB. */
export const EditorHome = () => {
  // `undefined` : pas encore lues. `null` : stockage illisible.
  const [stages, setStages] = useState<StoredStage[] | null | undefined>();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  // L'action qui attend la confirmation d'écraser le brouillon. `null` dans `stage` : nouvelle spéciale.
  const [replacing, setReplacing] = useState<{
    stage: StoredStage | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listStoredStages().then((found) => {
      if (cancelled) return;
      setStages(found);
      setDraft({ trace: readDraft(), stageKey: readDraftStage() });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const hasDraft = draft !== null && draft.trace.anchors.length > 0;
  const linked = stages?.find(({ key }) => key === draft?.stageKey);
  const unrolled =
    hasDraft && !(linked && sameTrace(linked.trace, draft.trace));

  const start = (stage: StoredStage | null): void => {
    if (!stage) {
      clearDraft();
      openTrace();
      return;
    }
    const trace = parseTrace(stage.trace);
    if (!trace || !writeDraft(trace)) {
      setError("Le tracé n'a pas pu être rouvert dans l'éditeur.");
      return;
    }
    writeDraftStage(stage.key);
    openTrace();
  };

  /** Un brouillon jamais roulé serait perdu sans retour : on demande d'abord. */
  const request = (stage: StoredStage | null): void => {
    if (stage && stage.key === draft?.stageKey) openTrace();
    else if (unrolled) setReplacing({ stage });
    else start(stage);
  };

  const remove = (key: string): void => {
    void deleteStoredStage(key).then((deleted) => {
      setError(
        deleted
          ? null
          : "La suppression a échoué : la spéciale est toujours là.",
      );
      if (!deleted) return;
      setStages((current) => current?.filter((stage) => stage.key !== key));
      // Le tracé reste en cours : le prochain « Rouler » en refera une spéciale.
      if (key === draft?.stageKey) {
        writeDraftStage(null);
        setDraft({ ...draft, stageKey: null });
      }
    });
  };

  return (
    <div className="dark shadcn-theme fixed inset-0 overflow-y-auto">
      <main className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
        <header className="flex items-center gap-2">
          <a
            href={GAME_URL}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            <ArrowLeft aria-hidden="true" />
            Retour au jeu
          </a>
          <h1 className="text-base font-semibold">Éditeur</h1>
          <Button className="ml-auto" onClick={() => request(null)}>
            <Plus aria-hidden="true" />
            Nouvelle spéciale
          </Button>
        </header>

        {hasDraft && !linked && (
          <section
            aria-label="Tracé en cours"
            className="flex items-center gap-2 rounded-lg border p-3"
          >
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-medium">
                Tracé en cours{draft.trace.name && ` : ${draft.trace.name}`}
              </h2>
              <p className="text-xs text-muted-foreground">
                Pas encore roulé, {draft.trace.anchors.length} point
                {draft.trace.anchors.length > 1 ? "s" : ""}.
              </p>
            </div>
            <a
              href={EDITOR_TRACE_URL}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Pencil aria-hidden="true" />
              Reprendre
            </a>
          </section>
        )}

        <h2 className="text-xs font-semibold text-muted-foreground uppercase">
          Mes spéciales
        </h2>

        <div aria-live="polite" className="text-sm empty:hidden">
          {stages === undefined && (
            <p className="text-muted-foreground">Lecture des spéciales…</p>
          )}
          {stages === null && (
            <p role="alert" className="text-destructive">
              Les spéciales de ce navigateur n&apos;ont pas pu être lues
              (navigation privée ou stockage bloqué).
            </p>
          )}
          {stages?.length === 0 && (
            <p className="text-muted-foreground">
              Aucune spéciale pour l&apos;instant : crée-en une, puis clique sur
              « Rouler » pour la tester.
            </p>
          )}
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
        </div>

        {stages && stages.length > 0 && (
          <ul>
            {stages.map((stage) => (
              <StageRow
                key={stage.key}
                stage={stage}
                hasUnrolledChanges={stage === linked && unrolled}
                onEdit={
                  parseTrace(stage.trace) ? () => request(stage) : undefined
                }
                onDelete={() => remove(stage.key)}
              />
            ))}
          </ul>
        )}

        <AlertDialog
          open={replacing !== null}
          onOpenChange={(open) => {
            if (!open) setReplacing(null);
          }}
        >
          {/* Rendue hors de la page, dans `body` : le thème sombre ne l'atteint pas tout seul. */}
          <AlertDialogContent className="dark">
            <AlertDialogHeader>
              <AlertDialogTitle>
                Abandonner le tracé en cours ?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Le tracé ouvert dans l&apos;éditeur contient des changements qui
                n&apos;ont pas été roulés. Ils seront définitivement perdus.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  if (replacing) start(replacing.stage);
                }}
              >
                Abandonner et continuer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
};
