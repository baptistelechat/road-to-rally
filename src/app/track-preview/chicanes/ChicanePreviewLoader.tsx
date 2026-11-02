"use client";

import dynamic from "next/dynamic";

// Three.js ne doit pas être évalué côté serveur, et `ssr: false` n'est permis que dans un composant client.
const ChicanePreview = dynamic(
  () => import("./ChicanePreview").then((mod) => mod.ChicanePreview),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 grid place-items-center bg-neutral-900 text-neutral-400">
        Chargement…
      </div>
    ),
  },
);

export const ChicanePreviewLoader = () => <ChicanePreview />;
