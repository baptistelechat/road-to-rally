"use client";

import { ArrowLeft, TriangleAlert } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { EDITOR_URL } from "@/game/maps";
import { useEditor } from "../store";
import { missingRunoff } from "../trace";
import { IssueList } from "./panel/IssueList";
import { Toolbar } from "./panel/PointsPanel";
import { RollPanel } from "./panel/RollPanel";

/** Le nombre de problèmes, et leur liste au clic : bloquants en rouge, à savoir en ambre. */
const IssuesButton = () => {
  const issues = useEditor((state) => state.issues);
  const analysisError = useEditor((state) => state.analysisError);
  const trace = useEditor((state) => state.history.present);
  const count =
    issues.length + (missingRunoff(trace) ? 1 : 0) + (analysisError ? 1 : 0);
  if (count === 0) return null;
  const blocking =
    analysisError !== null ||
    missingRunoff(trace) !== null ||
    issues.some((issue) => issue.blocking);
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant={blocking ? "destructive" : "outline"}
            size="sm"
            aria-label={`${count} problème${count > 1 ? "s" : ""} sur le tracé`}
          />
        }
      >
        <TriangleAlert aria-hidden="true" />
        {count}
      </PopoverTrigger>
      <PopoverContent align="end" className="dark w-80">
        <IssueList />
      </PopoverContent>
    </Popover>
  );
};

/** Tout ce qui agit sur la spéciale entière, au-dessus de la carte. */
export const TopBar = () => (
  <header className="flex flex-wrap items-center gap-2 border-b px-2 py-2">
    {/* Une vraie navigation : la carte et son contexte WebGL sont libérés. */}
    <a
      href={EDITOR_URL}
      className={buttonVariants({ variant: "ghost", size: "sm" })}
    >
      <ArrowLeft aria-hidden="true" />
      Mes spéciales
    </a>
    <h1 className="sr-only">Éditeur de spéciale</h1>
    <Toolbar />
    <div className="ml-auto flex min-w-0 items-center gap-2">
      <IssuesButton />
      <RollPanel />
    </div>
  </header>
);
