"use client";

import dynamic from "next/dynamic";

// Three.js et R3F ne doivent jamais être évalués côté serveur.
const GarageScene = dynamic(
  () => import("./GarageScene").then((mod) => mod.GarageScene),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 grid place-items-center bg-neutral-900 text-neutral-400">
        Chargement…
      </div>
    ),
  },
);

export const GarageLoader = () => <GarageScene />;
