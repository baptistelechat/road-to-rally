import type { ReactNode } from "react";
import { GARAGE_ROWS, RESET_ROW } from "../garageMenu";
import { ColorSection } from "./ColorSection";
import {
  FOCUS_VISIBLE,
  type LiveryPanelProps,
  MENU_FOCUS,
  SECTION_TITLE,
  scrollIfSelected,
} from "./menuStyles";
import { FlagRowView, StyleRowView, TextRowView } from "./RowViews";

export { MENU_FOCUS } from "./menuStyles";

/** Sections numérotées du panneau : chacune regroupe des lignes du menu par leur clé. */
const SECTIONS = [
  { id: "plaque", title: "Plaque", keys: ["plateText", "plateStyle"] },
  {
    id: "numero",
    title: "Numéro et drapeau",
    keys: ["numberText", "numberStyle", "flag"],
  },
  { id: "moteur", title: "Moteur", keys: ["engine"] },
] as const;

const Section = ({
  id,
  number,
  title,
  children,
}: {
  id: string;
  number: number;
  title: string;
  children: ReactNode;
}) => (
  <section aria-labelledby={`garage-${id}`} className="flex flex-col gap-2">
    <h2 id={`garage-${id}`} className={SECTION_TITLE}>
      {String(number).padStart(2, "0")} · {title}
    </h2>
    {children}
  </section>
);

const RowView = ({
  index,
  menu,
  dispatch,
}: LiveryPanelProps & { index: number }) => {
  const row = GARAGE_ROWS[index];
  const props = { index, menu, dispatch };
  if (row.kind === "text") return <TextRowView row={row} {...props} />;
  if (row.kind !== "style") return null;
  if (row.key === "flag") return <FlagRowView row={row} {...props} />;
  return <StyleRowView row={row} {...props} />;
};

const rowIndexes = (keys: readonly string[]): number[] =>
  GARAGE_ROWS.flatMap((row, index) =>
    "key" in row && keys.includes(row.key) ? [index] : [],
  );

export const LiveryPanel = ({ menu, dispatch }: LiveryPanelProps) => (
  <aside
    aria-label="Livrée"
    className="absolute top-16 bottom-0 left-0 flex w-100 max-w-full flex-col gap-4 overflow-y-auto border-r border-border bg-background px-6 py-5 text-sm text-foreground"
  >
    <Section id="couleurs" number={1} title="Couleurs">
      <ColorSection menu={menu} dispatch={dispatch} />
    </Section>
    {SECTIONS.map(({ id, title, keys }, i) => (
      <Section key={id} id={id} number={i + 2} title={title}>
        {rowIndexes(keys).map((index) => (
          <RowView key={index} index={index} menu={menu} dispatch={dispatch} />
        ))}
      </Section>
    ))}
    <div className="flex-1" />
    <button
      type="button"
      ref={scrollIfSelected(menu.row === RESET_ROW)}
      className={`min-h-11 shrink-0 cursor-pointer rounded border border-foreground/25 text-[13px] font-bold transition-colors hover:bg-accent ${FOCUS_VISIBLE} ${menu.row === RESET_ROW ? MENU_FOCUS : ""}`}
      onClick={() => dispatch({ type: "row", row: RESET_ROW })}
    >
      Couleurs d&apos;origine
    </button>
  </aside>
);
