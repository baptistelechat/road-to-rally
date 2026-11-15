import { ConfirmCancelHint } from "@/input/InputPrompt";
import {
  type ColorRow,
  GARAGE_ROWS,
  SWATCH_COLUMNS,
  SWATCHES,
} from "../garageMenu";
import {
  FACET_SWATCH,
  FOCUS_VISIBLE,
  HINT,
  type LiveryPanelProps,
  MENU_FOCUS,
  scrollIfSelected,
} from "./menuStyles";

const Palette = ({ menu, dispatch }: LiveryPanelProps) => (
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
            ref={scrollIfSelected(selected)}
            className={`aspect-square cursor-pointer rounded-[2px] ${selected ? "relative z-10 outline-2 outline-foreground" : ""}`}
            style={{ backgroundColor: hex }}
            onMouseEnter={() => dispatch({ type: "hover", swatch })}
            onClick={() => dispatch({ type: "pick", swatch })}
          />
        );
      })}
    </div>
    <ConfirmCancelHint className={HINT} />
  </div>
);

const COLOR_ROWS: readonly { row: ColorRow; index: number }[] =
  GARAGE_ROWS.flatMap((row, index) =>
    row.kind === "color" ? [{ row, index }] : [],
  );

/** Les quatre teintes en grille de deux ; la palette ouverte prend toute la largeur dessous. */
export const ColorSection = ({ menu, dispatch }: LiveryPanelProps) => {
  const open = COLOR_ROWS.some(({ index }) => index === menu.row);
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {COLOR_ROWS.map(({ row, index }) => {
          const selected = menu.row === index;
          return (
            <button
              key={row.key}
              type="button"
              ref={scrollIfSelected(selected)}
              aria-expanded={selected && menu.palette !== null}
              className={`flex min-h-11 cursor-pointer items-center gap-2.5 rounded border border-border bg-card px-2.5 text-left text-[13px] font-bold transition-colors hover:bg-accent ${FOCUS_VISIBLE} ${selected ? MENU_FOCUS : ""}`}
              onClick={() => dispatch({ type: "row", row: index })}
            >
              <span
                aria-hidden
                className={`size-7 shrink-0 ${FACET_SWATCH}`}
                style={{ backgroundColor: menu.livery[row.key] }}
              />
              {row.label}
            </button>
          );
        })}
      </div>
      {open && menu.palette && <Palette menu={menu} dispatch={dispatch} />}
    </>
  );
};
