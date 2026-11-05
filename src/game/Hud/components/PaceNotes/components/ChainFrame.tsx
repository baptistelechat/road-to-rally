import type { ReactNode } from "react";

/** Zigzag d'enfilade, pointe dans l'axe du dernier segment */
const ChainLogo = () => (
  <svg viewBox="0 0 64 64" aria-hidden="true" className="h-9 shrink-0">
    <path
      d="M30 60L18 48L44 36L18 24L28 17"
      fill="none"
      stroke="white"
      strokeWidth={6}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M32 22.7L37 10.7L24 11.3Z" fill="white" />
  </svg>
);

/** Trois points qui s'effacent : l'enfilade continue au-delà de la bande. */
const MoreDots = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 shrink-0">
    <circle cx={3} cy={10} r={2.5} fill="white" />
    <circle cx={10} cy={10} r={2.5} fill="white" opacity={0.7} />
    <circle cx={17} cy={10} r={2.5} fill="white" opacity={0.4} />
  </svg>
);

interface ChainFrameProps {
  /** L'enfilade continue au-delà de la bande : le bord droit reste ouvert. */
  open: boolean;
  children: ReactNode;
}

/** Capsule autour des notes d'une enfilade, zigzag en tête */
export const ChainFrame = ({ open, children }: ChainFrameProps) => (
  <li
    aria-label={open ? "Enfilade, la suite arrive" : "Enfilade"}
    className={`flex items-center gap-1 border-3 border-foreground bg-background/35 py-1 pl-2 ${open ? "rounded-l-full border-r-0" : "rounded-full pr-1"}`}
  >
    <ChainLogo />
    <ol className="flex gap-1">{children}</ol>
    {open && <MoreDots />}
  </li>
);
