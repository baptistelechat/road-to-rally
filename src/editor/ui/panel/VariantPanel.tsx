"use client";

import { Button } from "@/components/ui/button";
import { useEditor } from "../../store";
import { VARIANT_COLORS } from "../map/VariantRoutes";

const km = (meters: number): string =>
  `${(meters / 1000).toFixed(1).replace(".", ",")} km`;

/** Le résultat d'une recherche d'autres routes. Le joueur choisit : le tracé ne change jamais tout seul. */
export const VariantPanel = () => {
  const state = useEditor((store) => store.variants);
  const choose = useEditor((store) => store.chooseVariant);
  const dismiss = useEditor((store) => store.dismissVariants);
  if (!state) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Autres routes"
      role="group"
      className="mt-2 space-y-1 border-t pt-2 text-xs"
    >
      {state.kind === "searching" ? (
        <p className="text-muted-foreground">Recherche d&apos;autres routes…</p>
      ) : (
        <>
          {state.failure && (
            <p role="alert" className="text-destructive">
              {state.failure}
            </p>
          )}
          {state.variants.length === 0 && !state.failure && (
            <p>
              {state.rejected > 0
                ? "Aucune autre route utilisable ici : celles trouvées sont trop longues ou touchent le tracé."
                : "Aucune autre route ici."}
            </p>
          )}
          <ul className="space-y-1">
            {state.variants.map((variant, rank) => (
              <li key={variant.alternativeIdx}>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => choose(variant)}
                >
                  <span
                    aria-hidden="true"
                    className="size-2.5 rounded-full"
                    style={{
                      backgroundColor:
                        VARIANT_COLORS[rank % VARIANT_COLORS.length],
                    }}
                  />
                  {km(variant.length)},{" "}
                  {variant.turnsPerKm.toFixed(1).replace(".", ",")} virages/km
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
      <Button variant="ghost" size="sm" onClick={dismiss}>
        Fermer
      </Button>
    </div>
  );
};
