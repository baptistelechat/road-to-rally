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
        className={`flex cursor-pointer items-center justify-between gap-2 rounded border px-2 py-1.5 text-left transition-colors ${
          selected === id
            ? "border-white bg-white/20 font-semibold"
            : "border-white/25 hover:bg-white/15"
        }`}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => dispatch({ type: "style", row: rowIndex, style })}
      >
        {label}
        {validated === id && (
          <span
            aria-hidden
            className={`size-2 shrink-0 rounded-full bg-amber-400 ${playing === id ? "motion-safe:animate-pulse" : ""}`}
          />
        )}
      </button>
    ))}
  </div>
);
