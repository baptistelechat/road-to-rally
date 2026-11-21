"use client";

import { ArrowLeft, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  clearDraft,
  parseTrace,
  readDraft,
  readDraftStage,
  writeDraft,
  writeDraftStage,
} from "@/editor/draft";
import type { EditorTrace } from "@/editor/types";
import { backLink, capsLabel } from "@/editor/ui/styles";
import { AUTO_ROLL_PARAM, EDITOR_TRACE_URL } from "@/game/maps";
import {
  deleteStoredStage,
  listStoredStages,
  type StoredStage,
} from "@/game/stageCache";
import { cn } from "@/lib/utils";
import { DraftBanner } from "./components/DraftBanner";
import { ReplaceDraftDialog } from "./components/ReplaceDraftDialog";
import { StageRow } from "./components/StageRow";

// Une vraie navigation : la page de destination relit le brouillon, et la scène 3D démarre sur une page neuve.
const GAME_URL = "/";

interface Draft {
  trace: EditorTrace;
  stageKey: string | null;
}

const sameTrace = (stored: unknown, draft: EditorTrace): boolean =>
  JSON.stringify(parseTrace(stored)) === JSON.stringify(parseTrace(draft));

/** `roll` : l'éditeur lance la génération dès que le tracé est vérifié (bouton « Régénérer »). */
const openTrace = (roll = false): void =>
  window.location.assign(
    roll ? `${EDITOR_TRACE_URL}?${AUTO_ROLL_PARAM}=1` : EDITOR_TRACE_URL,
  );

/** Point d'entrée de l'éditeur : créer une spéciale, ou reprendre une de celles rangées dans IndexedDB. */
export const EditorHome = () => {
  // `undefined` : pas encore lues. `null` : stockage illisible.
  const [stages, setStages] = useState<StoredStage[] | null | undefined>();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  // L'action qui attend la confirmation d'écraser le brouillon. `null` dans `stage` : nouvelle spéciale.
  const [replacing, setReplacing] = useState<{
    stage: StoredStage | null;
    roll?: boolean;
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

  const start = (stage: StoredStage | null, roll = false): void => {
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
    openTrace(roll);
  };

  /** Un brouillon jamais roulé serait perdu sans retour : on demande d'abord. */
  const request = (stage: StoredStage | null, roll = false): void => {
    // Le brouillon est déjà ce tracé : il peut porter des changements, la régénération les prend avec.
    if (stage && stage.key === draft?.stageKey) openTrace(roll);
    else if (unrolled) setReplacing({ stage, roll });
    else start(stage, roll);
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
    <div className="dark fixed inset-0 overflow-y-auto bg-background text-foreground">
      <header className="flex h-18 items-center gap-5 border-b bg-card px-10">
        <a href={GAME_URL} className={backLink}>
          <ArrowLeft aria-hidden="true" />
          Retour au jeu
        </a>
        {/* eslint-disable-next-line @next/next/no-img-element -- logo SVG, rien à optimiser */}
        <img src="/icon.svg" alt="" className="size-9 rounded-lg" />
        <h1 className="font-display text-base tracking-[0.08em] uppercase">
          Éditeur
        </h1>
        <Button
          size="xl"
          font="display"
          className="ml-auto"
          onClick={() => request(null)}
        >
          <Plus aria-hidden="true" />
          Nouvelle spéciale
        </Button>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-7 px-10 py-8">
        {hasDraft && !linked && <DraftBanner trace={draft.trace} />}

        <section aria-labelledby="mes-speciales" className="flex flex-col gap-3.5">
          <h2 id="mes-speciales" className={cn(capsLabel, "uppercase")}>
            Mes spéciales{stages && stages.length > 0 && ` · ${stages.length}`}
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
                Aucune spéciale pour l&apos;instant : crée-en une, puis clique
                sur « Rouler » pour la tester.
              </p>
            )}
            {error && (
              <p role="alert" className="text-destructive">
                {error}
              </p>
            )}
          </div>

          {stages && stages.length > 0 && (
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {stages.map((stage) => (
                <StageRow
                  key={stage.key}
                  stage={stage}
                  hasUnrolledChanges={stage === linked && unrolled}
                  onEdit={
                    parseTrace(stage.trace) ? () => request(stage) : undefined
                  }
                  onRegenerate={
                    stage.outdated && parseTrace(stage.trace)
                      ? () => request(stage, true)
                      : undefined
                  }
                  onDelete={() => remove(stage.key)}
                />
              ))}
            </ul>
          )}
        </section>

        <ReplaceDraftDialog
          open={replacing !== null}
          onCancel={() => setReplacing(null)}
          onConfirm={() => {
            if (replacing) start(replacing.stage, replacing.roll);
          }}
        />
      </main>
    </div>
  );
};
