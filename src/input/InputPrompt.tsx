"use client";

import { type ReactNode, useEffect } from "react";
import {
  iconLabel,
  iconUrl,
  type PromptAction,
  promptIcons,
} from "./inputPrompts";
import {
  startPromptDeviceTracking,
  usePromptDevice,
  usePromptDeviceStore,
} from "./promptDevice";

/** À monter une fois par page qui affiche des commandes. */
export const InputDeviceTracker = () => {
  useEffect(() => startPromptDeviceTracking(window), []);
  return null;
};

const SIZES = { sm: "size-5", md: "size-6", lg: "size-8" } as const;

interface InputPromptProps {
  action: PromptAction;
  size?: keyof typeof SIZES;
  className?: string;
}

/** Icônes de la commande sur l'appareil en cours. Rien si l'action n'y existe pas. */
export const InputPrompt = ({
  action,
  size = "md",
  className = "",
}: InputPromptProps) => {
  const device = usePromptDevice();
  const layout = usePromptDeviceStore((s) => s.layout);
  const groups = promptIcons(action, device, layout);
  if (groups.length === 0) return null;
  const label = groups
    .map((group) => group.map(iconLabel).join(" "))
    .join(" ou ");
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`inline-flex shrink-0 items-center gap-0.5 align-middle ${className}`}
    >
      {groups.map((group, i) => (
        <span key={group.join()} className="contents">
          {i > 0 && (
            <span aria-hidden="true" className="px-0.5 text-muted-foreground">
              /
            </span>
          )}
          {group.map((name) => (
            // Petits SVG statiques : next/image n'apporterait rien et exige des dimensions fixes.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={name}
              src={iconUrl(device, name)}
              alt=""
              draggable={false}
              className={`${SIZES[size]} select-none`}
            />
          ))}
        </span>
      ))}
    </span>
  );
};

/** Les icônes de la commande suivies de son rôle, sur une ligne. */
export const InputHint = ({
  action,
  children,
}: {
  action: PromptAction;
  children: ReactNode;
}) => (
  <span className="flex items-center gap-1.5">
    <InputPrompt action={action} size="sm" />
    {children}
  </span>
);

/** Rappel des grilles et saisies du garage : valider et annuler. */
export const ConfirmCancelHint = ({
  className = "",
}: {
  className?: string;
}) => (
  <div className={`flex flex-col gap-1 ${className}`}>
    <InputHint action="confirm">Valider</InputHint>
    <InputHint action="cancel">Annuler</InputHint>
  </div>
);
