import type { EnginePresetId } from "@/audio/enginePresets";
import type { EngineRow, GarageMenuEvent } from "./garageMenu";

interface EnginePickerProps {
  row: EngineRow;
  rowIndex: number;
  selected: EnginePresetId;
  /** Moteur retenu : il porte la pastille */
  validated: string;
  /** Moteur en train de jouer sa démo : sa pastille pulse */
  playing: EnginePresetId | null;
  dispatch: (event: GarageMenuEvent) => void;
}

/** Un clic choisit le moteur et joue sa démo. Recliquer la relance. */
export const EnginePicker = ({
  row,
  rowIndex,
  selected,
  validated,
  playing,
  dispatch,
}: EnginePickerProps) => (
  <div role="group" aria-label={row.label} className="flex flex-col gap-1">
    {row.styles.map(({ id, label }, style) => (
      <button
        key={id}
        type="button"
        aria-pressed={selected === id}
        tabIndex={-1}
        className={`flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded border px-3 text-left text-xs transition-colors ${
          selected === id
            ? "border-ring bg-accent font-extrabold"
            : "border-border bg-card font-bold hover:bg-accent"
        }`}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => dispatch({ type: "style", row: rowIndex, style })}
      >
        {label}
        {validated === id && (
          <span
            aria-hidden
            className={`size-2 shrink-0 rounded-full bg-ring ${playing === id ? "motion-safe:animate-pulse" : ""}`}
          />
        )}
      </button>
    ))}
  </div>
);
