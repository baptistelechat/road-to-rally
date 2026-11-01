import { useEffect, useRef } from "react";
import {
  drawNumber,
  drawPlate,
  NUMBER_SIZE,
  PLATE_SIZE,
} from "@/render/car/decals";
import type { Livery } from "@/render/car/livery";
import type {
  GarageMenu,
  DecalStyleRow,
  GarageMenuEvent,
  TextRow,
} from "./garageMenu";

type Dispatch = (event: GarageMenuEvent) => void;
type Draw = (ctx: CanvasRenderingContext2D) => void;

const DecalThumb = ({
  size,
  draw,
}: {
  size: readonly [number, number];
  draw: Draw;
}) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (ctx) draw(ctx);
  });
  return (
    <canvas
      ref={canvas}
      width={size[0]}
      height={size[1]}
      aria-hidden
      className="block w-full"
    />
  );
};

const styleThumbs = (row: DecalStyleRow, livery: Livery) => {
  if (row.key === "plateStyle")
    return row.styles.map(({ id, label }) => ({
      id,
      label,
      size: PLATE_SIZE,
      draw: ((ctx) => drawPlate(ctx, livery.plateText, id)) as Draw,
    }));
  return row.styles.map(({ id, label }) => ({
    id,
    label,
    size: NUMBER_SIZE,
    draw: ((ctx) =>
      drawNumber(ctx, livery.numberText, id, livery.accent)) as Draw,
  }));
};

interface StylePickerProps {
  row: DecalStyleRow;
  rowIndex: number;
  open: boolean;
  livery: Livery;
  dispatch: Dispatch;
}

/** Un clic choisit le style. Au clavier et à la manette, valider ouvre la grille : les flèches s'y déplacent. */
export const StylePicker = ({
  row,
  rowIndex,
  open,
  livery,
  dispatch,
}: StylePickerProps) => (
  <>
    <div
      role="group"
      aria-label={row.label}
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${row.columns}, minmax(0, 1fr))` }}
    >
      {styleThumbs(row, livery).map(({ id, label, size, draw }, style) => (
        <button
          key={id}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={livery[row.key] === id}
          tabIndex={-1}
          className={`cursor-pointer rounded-[2px] bg-neutral-500 p-0.5 ${livery[row.key] === id ? "outline-2 outline-white" : ""}`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => dispatch({ type: "style", row: rowIndex, style })}
        >
          <DecalThumb size={size} draw={draw} />
        </button>
      ))}
    </div>
    {open && (
      <p className="text-xs text-white/70">
        Valider : Entrée ou A
        <br />
        Annuler : Échap ou B
      </p>
    )}
  </>
);

interface SlotEditorProps {
  row: TextRow;
  text: NonNullable<GarageMenu["text"]>;
  value: string;
  dispatch: Dispatch;
}

const ARROW_BUTTON =
  "flex-1 cursor-pointer rounded border border-white/25 py-0.5 hover:bg-white/15";

export const SlotEditor = ({ row, text, value, dispatch }: SlotEditorProps) => (
  <div className="flex flex-col gap-1.5">
    <div
      className="grid gap-0.5 font-mono"
      style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}
    >
      {[...value].map((char, slot) => (
        <button
          key={slot}
          type="button"
          tabIndex={-1}
          aria-label={`Caractère ${slot + 1} : ${char === " " ? "vide" : char}`}
          aria-pressed={text.slot === slot}
          className={`h-7 cursor-pointer rounded-[2px] bg-white/10 ${text.slot === slot ? "outline-2 outline-white" : ""}`}
          // Sans le focus sur la case, Entrée continue de valider toute la saisie.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => dispatch({ type: "slot", slot })}
        >
          {char}
        </button>
      ))}
    </div>
    <div className="flex gap-1">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Caractère suivant"
        className={ARROW_BUTTON}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => dispatch("up")}
      >
        ▲
      </button>
      <button
        type="button"
        tabIndex={-1}
        aria-label="Caractère précédent"
        className={ARROW_BUTTON}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => dispatch("down")}
      >
        ▼
      </button>
    </div>
    <p className="text-xs text-white/70">
      Taper au clavier ou utiliser les flèches
      <br />
      Valider : Entrée ou A
      <br />
      Annuler : Échap ou B
    </p>
  </div>
);
