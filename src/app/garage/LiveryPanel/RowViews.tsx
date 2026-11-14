import { FLAGS } from "@/render/car/flags";
import { SlotEditor, StylePicker } from "../DecalControls";
import { EnginePicker } from "../EnginePicker";
import { FlagPicker, FlagThumb } from "../FlagPicker";
import {
  type FlagRow,
  type StyleRow,
  type TextRow,
  validatedEngine,
} from "../garageMenu";
import {
  FIELD,
  FOCUS_VISIBLE,
  type LiveryPanelProps,
  MENU_FOCUS,
  scrollIfSelected,
} from "./menuStyles";

interface RowViewProps<Row> extends LiveryPanelProps {
  row: Row;
  index: number;
}

export const TextRowView = ({
  row,
  index,
  menu,
  dispatch,
}: RowViewProps<TextRow>) => {
  const selected = menu.row === index;
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        ref={scrollIfSelected(selected)}
        aria-expanded={selected && menu.text !== null}
        className={`cursor-pointer transition-colors hover:bg-accent ${FIELD} ${FOCUS_VISIBLE} ${selected ? MENU_FOCUS : ""}`}
        onClick={() => dispatch({ type: "row", row: index })}
      >
        <span className="text-xs font-bold text-muted-foreground">
          {row.label}
        </span>
        <span className="font-mono text-base tracking-[0.08em] whitespace-pre">
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
};

export const FlagRowView = ({
  row,
  index,
  menu,
  dispatch,
}: RowViewProps<FlagRow>) => {
  const selected = menu.row === index;
  const label = FLAGS.find(({ id }) => id === menu.livery.flag)?.label;
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        ref={scrollIfSelected(selected)}
        aria-expanded={selected && menu.picker !== null}
        className={`flex min-h-11 cursor-pointer items-center gap-2.5 rounded border border-border bg-card px-3 text-left text-[13px] font-bold transition-colors hover:bg-accent ${FOCUS_VISIBLE} ${selected ? MENU_FOCUS : ""}`}
        onClick={() => dispatch({ type: "row", row: index })}
      >
        <span className="w-9 shrink-0">
          <FlagThumb code={menu.livery.flag} />
        </span>
        <span className="min-w-0 truncate">
          {row.label} : {label}
        </span>
        <span className="ml-auto text-muted-foreground">Changer</span>
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
};

/** Styles de plaque et de numéro, et moteur : la grille reste visible, valider l'ouvre à la manette. */
export const StyleRowView = ({
  row,
  index,
  menu,
  dispatch,
}: RowViewProps<Exclude<StyleRow, FlagRow>>) => {
  const selected = menu.row === index;
  return (
    <div
      ref={scrollIfSelected(selected)}
      className={`flex flex-col gap-1.5 rounded ${selected ? MENU_FOCUS : ""}`}
    >
      {/* Le titre de section « Moteur » suffit ; le groupe garde son aria-label. */}
      {row.key !== "engine" && (
        <span className="text-xs font-bold text-muted-foreground">
          {row.label}
        </span>
      )}
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
};
