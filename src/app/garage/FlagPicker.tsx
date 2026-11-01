import { memo, useEffect, useRef, useState } from "react";
import {
  drawFlagWhenSettled,
  FLAGS,
  loadFlagImages,
  NO_FLAG,
} from "@/render/car/flags";
import type { FlagRow, GarageMenuEvent } from "./garageMenu";

const THUMB_SIZE = [96, 64] as const;

type Dispatch = (event: GarageMenuEvent) => void;

/** Le drapeau tel qu'il sera sur la voiture, en triangles. */
export const FlagThumb = memo(function FlagThumb({ code }: { code: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => drawFlagWhenSettled(code, () => canvas.current), [code]);
  return (
    <canvas
      ref={canvas}
      width={THUMB_SIZE[0]}
      height={THUMB_SIZE[1]}
      aria-hidden
      className="block w-full"
    />
  );
});

interface FlagCellProps {
  id: string;
  label: string;
  style: number;
  rowIndex: number;
  image: string | undefined;
  selected: boolean;
  dispatch: Dispatch;
}

/** Mémorisée : un essai ne redessine que l'ancienne et la nouvelle case, pas toute la grille. */
const FlagCell = memo(function FlagCell({
  id,
  label,
  style,
  rowIndex,
  image,
  selected,
  dispatch,
}: FlagCellProps) {
  return (
    <button
      type="button"
      tabIndex={-1}
      title={label}
      aria-label={label}
      aria-pressed={selected}
      ref={
        selected
          ? (element) => element?.scrollIntoView({ block: "nearest" })
          : undefined
      }
      className={`flex aspect-3/2 cursor-pointer items-center justify-center rounded-[2px] bg-white/10 text-xs leading-none ${selected ? "relative z-10 outline-2 outline-white" : ""}`}
      onMouseDown={(event) => event.preventDefault()}
      onMouseEnter={() => dispatch({ type: "try", style })}
      onClick={() => dispatch({ type: "style", row: rowIndex, style })}
    >
      {id === NO_FLAG && <span aria-hidden>∅</span>}
      {image && (
        // Le SVG brut suffit à cette taille : `next/image` n'apporte rien sur une URL data, et `lazy` ne décode que les lignes visibles.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          loading="lazy"
          decoding="async"
          className="block h-full w-full"
        />
      )}
    </button>
  );
});

interface FlagPickerProps {
  row: FlagRow;
  rowIndex: number;
  selected: string;
  dispatch: Dispatch;
}

export const FlagPicker = ({
  row,
  rowIndex,
  selected,
  dispatch,
}: FlagPickerProps) => {
  const [images, setImages] = useState<Record<string, string>>({});
  useEffect(() => {
    let stale = false;
    void loadFlagImages().then((loaded) => {
      if (!stale) setImages(loaded);
    });
    return () => {
      stale = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="group"
        aria-label={row.label}
        className="grid max-h-56 gap-1 overflow-y-auto p-0.5"
        style={{
          gridTemplateColumns: `repeat(${row.columns}, minmax(0, 1fr))`,
        }}
      >
        {FLAGS.map(({ id, label }, style) => (
          <FlagCell
            key={id}
            id={id}
            label={label}
            style={style}
            rowIndex={rowIndex}
            image={images[id]}
            selected={selected === id}
            dispatch={dispatch}
          />
        ))}
      </div>
      <p className="text-xs text-white/70">
        Valider : clic, Entrée ou A
        <br />
        Annuler : Échap ou B
      </p>
    </div>
  );
};
