import type { ReactNode } from "react";

/** Zigzag d'enfilade, pointe dans l'axe du dernier segment */
const ChainLogo = () => (
  <svg viewBox="0 0 64 64" aria-hidden="true" className="h-[34px] shrink-0">
    <path
      d="M30 60L18 48L44 36L18 24L28 17"
      fill="none"
      strokeWidth={6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="stroke-foreground"
    />
    <path d="M32 22.7L37 10.7L24 11.3Z" className="fill-foreground" />
  </svg>
);

/** Trois points qui s'effacent : l'enfilade continue au-delà de la bande. */
const MoreDots = () => (
  <svg
    viewBox="0 0 20 20"
    aria-hidden="true"
    className="h-5 shrink-0 fill-foreground"
  >
    <circle cx={3} cy={10} r={2.5} />
    <circle cx={10} cy={10} r={2.5} opacity={0.7} />
    <circle cx={17} cy={10} r={2.5} opacity={0.4} />
  </svg>
);

interface ChainFrameProps {
  /** L'enfilade continue au-delà de la bande : le bord droit reste ouvert. */
  open: boolean;
  children: ReactNode;
}

/** Cadre facetté autour des notes d'une enfilade, zigzag en tête */
export const ChainFrame = ({ open, children }: ChainFrameProps) => (
  <li
    aria-label={open ? "Enfilade, la suite arrive" : "Enfilade"}
    className={`flex items-center gap-1.5 border-y-3 border-foreground bg-background/45 py-1.5 pl-[18px] ${open ? "[clip-path:polygon(14px_0,100%_0,100%_100%,0_100%)]" : "pr-[18px] [clip-path:polygon(14px_0,100%_0,calc(100%_-_14px)_100%,0_100%)]"}`}
  >
    <ChainLogo />
    <ol className="flex gap-1.5">{children}</ol>
    {open && <MoreDots />}
  </li>
);
