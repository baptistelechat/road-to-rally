import {
  type GarageMenu,
  type GarageMenuEvent,
  LIVERY_FIELDS,
  RESET_ROW,
  SWATCH_COLUMNS,
  SWATCHES,
} from "./garageMenu";

/** Contour de la ligne sélectionnée, quel que soit le périphérique */
export const MENU_FOCUS = "outline-2 outline-offset-2 outline-amber-400";

const FOCUS_VISIBLE = "focus-visible:outline-2 focus-visible:outline-amber-400";

interface LiveryPanelProps {
  menu: GarageMenu;
  dispatch: (event: GarageMenuEvent) => void;
}

export const LiveryPanel = ({ menu, dispatch }: LiveryPanelProps) => (
  <div className="absolute top-4 left-4 flex max-h-[calc(100%-2rem)] w-52 flex-col gap-2 overflow-y-auto rounded border border-white/25 bg-black/70 p-3 text-sm text-white">
    {LIVERY_FIELDS.map(([key, label], row) => (
      <div key={key} className="flex flex-col gap-2">
        <button
          type="button"
          aria-expanded={menu.row === row && menu.palette !== null}
          className={`flex cursor-pointer items-center justify-between gap-3 rounded text-left ${FOCUS_VISIBLE} ${menu.row === row ? MENU_FOCUS : ""}`}
          onClick={() => dispatch({ type: "row", row })}
        >
          {label}
          <span
            className="h-7 w-12 rounded border border-white/25"
            style={{ backgroundColor: menu.livery[key] }}
          />
        </button>
        {menu.row === row && menu.palette && (
          <div className="flex flex-col gap-1.5">
            <div
              className="grid gap-0.5"
              style={{
                gridTemplateColumns: `repeat(${SWATCH_COLUMNS}, minmax(0, 1fr))`,
              }}
            >
              {SWATCHES.map(({ name, hex }, swatch) => {
                const selected = menu.palette?.swatch === swatch;
                return (
                  <button
                    key={name}
                    type="button"
                    tabIndex={-1}
                    title={name}
                    aria-label={name}
                    aria-pressed={selected}
                    // Le pointeur sur une case de la palette la sélectionne, comme la croix.
                    ref={
                      selected
                        ? (element) =>
                            element?.scrollIntoView({ block: "nearest" })
                        : undefined
                    }
                    className={`aspect-square cursor-pointer rounded-[2px] ${selected ? "relative z-10 outline-2 outline-white" : ""}`}
                    style={{ backgroundColor: hex }}
                    onMouseEnter={() => dispatch({ type: "hover", swatch })}
                    onClick={() => dispatch({ type: "pick", swatch })}
                  />
                );
              })}
            </div>
            <p className="text-xs text-white/70">
              Valider : clic, Entrée ou A
              <br />
              Annuler : Échap ou B
            </p>
          </div>
        )}
      </div>
    ))}
    <button
      type="button"
      className={`mt-1 cursor-pointer rounded border border-white/25 px-2 py-1 font-semibold transition-colors hover:bg-white/15 ${FOCUS_VISIBLE} ${menu.row === RESET_ROW ? MENU_FOCUS : ""}`}
      onClick={() => dispatch({ type: "row", row: RESET_ROW })}
    >
      Couleurs d&apos;origine
    </button>
  </div>
);
