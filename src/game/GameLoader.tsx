"use client";

import dynamic from "next/dynamic";

// La détection du tactile a besoin du navigateur : rien ne s'évalue côté serveur.
export const GameLoader = dynamic(
  () => import("./GameEntry").then((mod) => mod.GameEntry),
  { ssr: false },
);
