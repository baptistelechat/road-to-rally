"use client";

import dynamic from "next/dynamic";

// MapLibre a besoin du navigateur : il n'est jamais évalué côté serveur.
const EditorApp = dynamic(
  () => import("@/editor/ui/EditorApp").then((mod) => mod.EditorApp),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 grid place-items-center bg-background text-muted-foreground">
        Chargement…
      </div>
    ),
  },
);

export const EditorLoader = () => <EditorApp />;
