import { FLAGS } from "@/render/car/flags";
import { SlotEditor, StylePicker } from "./DecalControls";
import { EnginePicker } from "./EnginePicker";
import { FlagPicker, FlagThumb } from "./FlagPicker";
import {
  type ColorRow,
  GARAGE_ROWS,
  type GarageMenu,
  type GarageMenuEvent,
  RESET_ROW,
  SWATCH_COLUMNS,
  SWATCHES,
  validatedEngine,
} from "./garageMenu";

/** Contour de la ligne sélectionnée, quel que soit le périphérique */
export const MENU_FOCUS = "outline-2 outline-offset-2 outline-amber-400";

const FOCUS_VISIBLE = "focus-visible:outline-2 focus-visible:outline-amber-400";

/** La ligne sélectionnée reste visible quand la manette fait défiler le panneau. */
const scrollIfSelected = (selected: boolean) =>
  selected
    ? (element: HTMLElement | null) =>
        element?.scrollIntoView({ block: "nearest" })
    : undefined;

interface LiveryPanelProps {
  menu: GarageMenu;
  dispatch: (event: GarageMenuEvent) => void;
}

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
);

const rowHeader = (selected: boolean): string =>
  `flex cursor-pointer items-center justify-between gap-3 rounded text-left ${FOCUS_VISIBLE} ${selected ? MENU_FOCUS : ""}`;

const ColorRowView = ({
  row,
  index,
  menu,
  dispatch,
}: LiveryPanelProps & { row: ColorRow; index: number }) => {
  const selected = menu.row === index;
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        ref={scrollIfSelected(selected)}
        aria-expanded={selected && menu.palette !== null}
        className={rowHeader(selected)}
        onClick={() => dispatch({ type: "row", row: index })}
      >
        {row.label}
        <span
          className="h-7 w-12 rounded border border-white/25"
          style={{ backgroundColor: menu.livery[row.key] }}
        />
      </button>
      {selected && menu.palette && <Palette menu={menu} dispatch={dispatch} />}
    </div>
  );
};

export const LiveryPanel = ({ menu, dispatch }: LiveryPanelProps) => (
  <div className="absolute top-4 left-4 flex max-h-[calc(100%-2rem)] w-60 flex-col gap-2 overflow-y-auto rounded border border-white/25 bg-black/70 p-3 text-sm text-white">
    {GARAGE_ROWS.map((row, index) => {
      const selected = menu.row === index;
      switch (row.kind) {
        case "color":
          return (
            <ColorRowView
              key={row.key}
              row={row}
              index={index}
              menu={menu}
              dispatch={dispatch}
            />
          );
        case "text":
          return (
            <div key={row.key} className="flex flex-col gap-2">
              <button
                type="button"
                ref={scrollIfSelected(selected)}
                aria-expanded={selected && menu.text !== null}
                className={rowHeader(selected)}
                onClick={() => dispatch({ type: "row", row: index })}
              >
                {row.label}
                <span className="font-mono whitespace-pre">
                  {menu.livery[row.key].trimEnd() || "—"}
                </span>
              </button>
              {selected && menu.text && (
                <SlotEditor
                  row={row}
                  text={menu.text}
                  value={menu.livery[row.key]}
                  dispatch={dispatch}
                />
              )}
            </div>
          );
        case "style":
          if (row.key === "flag")
            return (
              <div key={row.key} className="flex flex-col gap-2">
                <button
                  type="button"
                  ref={scrollIfSelected(selected)}
                  aria-expanded={selected && menu.picker !== null}
                  className={rowHeader(selected)}
                  onClick={() => dispatch({ type: "row", row: index })}
                >
                  {row.label}
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate">
                      {FLAGS.find(({ id }) => id === menu.livery.flag)?.label}
                    </span>
                    <span className="w-9 shrink-0">
                      <FlagThumb code={menu.livery.flag} />
                    </span>
                  </span>
                </button>
                {selected && menu.picker && (
                  <FlagPicker
                    row={row}
                    rowIndex={index}
                    selected={menu.livery.flag}
                    dispatch={dispatch}
                  />
                )}
              </div>
            );
          return (
            <div
              key={row.key}
              ref={scrollIfSelected(selected)}
              className={`flex flex-col gap-1.5 rounded ${selected ? MENU_FOCUS : ""}`}
            >
              {row.label}
              {row.key === "engine" ? (
                <EnginePicker
                  row={row}
                  rowIndex={index}
                  selected={menu.livery.engine}
                  validated={validatedEngine(menu)}
                  playing={menu.engineDemo?.engine ?? null}
                  dispatch={dispatch}
                />
              ) : (
                <StylePicker
                  row={row}
                  rowIndex={index}
                  open={selected && menu.picker !== null}
                  livery={menu.livery}
                  dispatch={dispatch}
                />
              )}
            </div>
          );
        case "reset":
          return (
            <button
              key="reset"
              type="button"
              ref={scrollIfSelected(selected)}
              className={`mt-1 cursor-pointer rounded border border-white/25 px-2 py-1 font-semibold transition-colors hover:bg-white/15 ${FOCUS_VISIBLE} ${menu.row === RESET_ROW ? MENU_FOCUS : ""}`}
              onClick={() => dispatch({ type: "row", row: RESET_ROW })}
            >
              Couleurs d&apos;origine
            </button>
          );
        default:
          return null;
      }
    })}
  </div>
);
