"use client";

import dynamic from "next/dynamic";

// Three.js ne doit pas être évalué côté serveur, et `ssr: false` n'est permis que dans un composant client.
const TrackPreview = dynamic(
  () => import("./TrackPreview").then((mod) => mod.TrackPreview),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 grid place-items-center bg-neutral-900 text-neutral-400">
        Chargement…
      </div>
    ),
  },
);

export const TrackPreviewLoader = () => <TrackPreview />;
